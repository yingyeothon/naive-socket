import NaiveSocket from "../src";
import { createServer } from "net";

test("reconnect", async () => {
  const testPort = 34567;
  const testMessage = `HelloWorld`;
  const ns = new NaiveSocket({
    host: "localhost",
    port: testPort,
    connectionRetryInterval: 50,
  });

  // Run an echo server after 300ms.
  setTimeout(() => {
    const server = createServer((client) => {
      client.on("data", (chunk) => {
        const message = chunk.toString();
        expect(message).toEqual(testMessage);
        client.write(message);

        // Close sockets after 10ms.
        setTimeout(() => {
          client.destroy();
          server.close();
        }, 10);
      });
    }).listen(testPort);
    console.log(`Server listens on ${testPort}`);
  }, 300);

  const response = await ns.send({
    message: testMessage,
    timeoutMillis: 1000,
  });
  expect(response).toEqual(testMessage);
  ns.disconnect();
});

test("not-alive-after-disconnect", async () => {
  const ns = new NaiveSocket({
    host: "localhost",
    port: 12347, // Should be an invalid port.
    connectionRetryInterval: -1, // Do not reconnect.
  });
  try {
    const promise = ns.send({
      message: "SHOULD FAIL",
      timeoutMillis: 100,
    });
    ns.disconnect();
    await promise;
    fail();
  } catch (error) {
    expect(error.message).toContain(`DeadSocket`);
  }
});
