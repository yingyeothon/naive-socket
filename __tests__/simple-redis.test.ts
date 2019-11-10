import NaiveSocket from "../src";

test("simple-set", async () => {
  const ns = new NaiveSocket({
    host: "localhost",
    port: 6379
  });
  const result = await ns.send({
    message: `SET "simple" "value"\r\n`
  });
  expect(result).toEqual("+OK\r\n");
  ns.disconnect();
});

test("flushall", async () => {
  const ns = new NaiveSocket({
    host: "localhost",
    port: 6379
  });
  const result = await ns.send({
    message: `FLUSHALL\r\n`
  });
  expect(result).toEqual("+OK\r\n");
  ns.disconnect();
});

test("get-if-absent", async () => {
  const ns = new NaiveSocket({
    host: "localhost",
    port: 6379
  });
  const result = await ns.send({
    message: `GET "no-value"\r\n`
  });
  expect(result).toEqual("$-1\r\n");
  ns.disconnect();
});

test("get-if-present", async () => {
  const ns = new NaiveSocket({
    host: "localhost",
    port: 6379
  });
  const set = await ns.send({
    message: `SET "has-value" "12345"\r\n`
  });
  expect(set).toEqual("+OK\r\n");
  const get = await ns.send({
    message: `GET "has-value"\r\n`
  });
  expect(get).toEqual("$5\r\n12345\r\n");
  ns.disconnect();
});
