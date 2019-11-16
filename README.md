# Naive Socket

This is a very lightweight library to communicate with the opposite using `net.Socket`.

## Rationale

I'm a Serverless programmer and I want to reduce a deployment package size as possible as I can. There are lots of many libraries to do anything in this world but because of this they have the big codebase sometimes. For example, [`ioredis`](https://github.com/luin/ioredis) is the perfect library to use Redis in NodeJS but it is very big to use in Serverless environment.

This library is a very naive wrapper of `net.Socket` so it doesn't have functions to use. This is proper to use only when there is no need for complex features while communicating with the opposite, for example, the case of only sending an one command to Redis and finished.

## Example

This is a simple example to communicate with Redis with 2 cases.

1. Send a message via Redis queue.
2. Retrieve a gameId by userId.

```typescript
import NaiveSocket from "@yingyeothon/naive-socket";

const redisNewline = `\r\n`;
const naiveSocket = new NaiveSocket({
  host: "localhost",
  port: 6379
});

export const enqueueGameMessage = (gameId: string, message: any) =>
  naiveSocket.send({
    message: [
      `RPUSH "queue/${gameId}" "${JSON.stringify(JSON.stringify(message))}"`,
      ``
    ].join(redisNewline),
    timeoutMillis: 1000
  });

export const loadGameId = (userId: string) =>
  naiveSocket
    .send({
      message: [`GET "gameId/${userId}"`, ``].join(redisNewline),
      // When the pattern of gameId is UUID.
      isFulfilled: /^(\$[0-9]+\r\n(?:[0-9A-Za-z_\-]+)\r\n|\$-1\r\n)/
    })
    .then(response => response.match(/([0-9A-F\-]+)\r\n/)[1] || "");
```

## License

MIT
