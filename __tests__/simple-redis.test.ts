import NaiveSocket from "../src";
import TextMatch, { withMatch } from "../src/match";

const newSocketForRedis = () =>
  new NaiveSocket({
    host: "localhost",
    port: 6379
  });

const redisWork = (work: (ns: NaiveSocket) => Promise<any>) => async () => {
  const ns = newSocketForRedis();
  await work(ns);
  ns.disconnect();
};

const encode = (commands: string[][]) =>
  commands
    .map(command =>
      command
        .map((token, index) => (index === 0 ? token : `"${token}"`))
        .join(" ")
    )
    .concat([``])
    .join("\r\n");

const clearRedis = redisWork(ns =>
  ns.send({
    message: `FLUSHALL\r\n`
  })
);

beforeAll(clearRedis);
afterAll(clearRedis);

test(
  "simple-set",
  redisWork(async ns => {
    const result = await ns.send({
      message: encode([["SET", "simple", "value"]])
    });
    expect(result).toEqual("+OK\r\n");
  })
);

test(
  "get-if-absent",
  redisWork(async ns => {
    const result = await ns.send({
      message: encode([["GET", "no-value"]])
    });
    expect(result).toEqual("$-1\r\n");
  })
);

test(
  "get-if-present",
  redisWork(async ns => {
    const set = await ns.send({
      message: encode([["SET", "has-value", "12345"]])
    });
    expect(set).toEqual("+OK\r\n");
    const get = await ns.send({
      message: encode([["GET", "has-value"]])
    });
    expect(get).toEqual("$5\r\n12345\r\n");
  })
);

test(
  "get-with-complex-pattern",
  redisWork(async ns => {
    const uuid = `8aede689-bb97-4a3a-8d1e-7f0edf6bd850`;
    const set = await ns.send({
      message: encode([["SET", "complex-value", uuid]]),
      fulfill: /^(\+OK\r\n)$/
    });
    expect(set).toEqual("+OK\r\n");
    const get = await ns.send({
      message: encode([["GET", "complex-value"]]),
      fulfill: /^(\$[0-9]+\r\n[0-9A-Za-z\-]+\r\n)$/
    });
    expect(get).toEqual(`$${uuid.length}\r\n${uuid}\r\n`);
  })
);

test(
  "get-with-wrong-pattern",
  redisWork(async ns => {
    const set = await ns.send({
      message: `SET "wrong-pattern" "12345"\r\n`,
      fulfill: /^(\+OK\r\n)$/
    });
    expect(set).toEqual("+OK\r\n");
    try {
      await ns.send({
        message: `GET "wrong-pattern"\r\n`,
        fulfill: /^(\$[0-9]+\r\n[A-Z]+\r\n)$/,
        timeoutMillis: 100
      });
      fail();
    } catch (error) {
      expect(error.message).toContain("Timeout");
    }
  })
);

test(
  "multiple-set",
  redisWork(async ns => {
    const set = await ns.send({
      message: encode([
        ["SET", "test-value-1", "12345"],
        ["SET", "test-value-2", "34567"],
        ["SET", "test-value-3", "67890"]
      ])
    });
    expect(set).toEqual("+OK\r\n+OK\r\n+OK\r\n");
  })
);

test(
  "set-add-remove",
  redisWork(async ns => {
    const expected = ":1\r\n:1\r\n:0\r\n:0\r\n:1\r\n";
    const set = await ns.send({
      message: encode([
        ["SADD", "test-my-set", "12345"],
        ["SADD", "test-my-set", "34567"],
        ["SADD", "test-my-set", "12345"],
        ["SREM", "test-my-set", "23456"],
        ["SREM", "test-my-set", "12345"]
      ]),
      fulfill: expected.length,
      timeoutMillis: 1000
    });
    expect(set).toEqual(expected);
  })
);

test(
  "set-add-members",
  redisWork(async ns => {
    const expected = [
      ":1",
      ":1",
      ":0",
      "*2",
      "$5",
      "12345",
      "$5",
      "34567",
      ""
    ].join("\r\n");
    const set = await ns.send({
      message: encode([
        ["SADD", "test-my-set2", "12345"],
        ["SADD", "test-my-set2", "34567"],
        ["SADD", "test-my-set2", "12345"],
        ["SMEMBERS", "test-my-set2"]
      ]),
      fulfill: expected.length,
      timeoutMillis: 1000
    });
    expect(set).toEqual(expected);
  })
);

test(
  "set-add-members-with-check",
  redisWork(async ns => {
    const setAnswer = [":1", ":1", ":0", ""].join("\r\n");
    const set = await ns.send({
      message: encode([
        ["SADD", "test-my-set3", "123456"],
        ["SADD", "test-my-set3", "abcde"],
        ["SADD", "test-my-set3", "123456"]
      ]),
      fulfill: setAnswer.length,
      timeoutMillis: 1000
    });
    expect(set).toEqual(setAnswer);

    const match = (m: TextMatch) => {
      let count = +m
        .capture("\r\n")
        .values()[0]
        .slice(1);
      while (count-- > 0) {
        m.capture("\r\n").capture("\r\n");
      }
      return m;
    };
    const membersAnswer = ["*2", "$5", "abcde", "$6", "123456"];
    const members = await ns.send({
      message: encode([["SMEMBERS", "test-my-set3"]]),
      fulfill: withMatch(match),
      timeoutMillis: 1000
    });
    expect(
      match(new TextMatch(members))
        .values()
        .sort()
    ).toEqual(membersAnswer.sort());
  })
);
