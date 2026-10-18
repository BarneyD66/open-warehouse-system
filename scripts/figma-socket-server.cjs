const WebSocket = require("next/dist/compiled/ws");

const port = Number(process.env.FIGMA_SOCKET_PORT || 3055);
const channels = new Map();

const server = new WebSocket.Server({ port });

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

server.on("connection", (ws) => {
  console.log("New client connected");
  send(ws, {
    type: "system",
    message: "Please join a channel to start chatting",
  });

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      console.log(`Received: ${data.type} / ${data.channel || "N/A"}`);

      if (data.type === "join") {
        const channelName = data.channel;
        if (!channelName || typeof channelName !== "string") {
          send(ws, { type: "error", message: "Channel name is required" });
          return;
        }

        if (!channels.has(channelName)) channels.set(channelName, new Set());
        const clients = channels.get(channelName);
        clients.add(ws);
        ws.__figmaChannel = channelName;

        send(ws, {
          type: "system",
          message: `Joined channel: ${channelName}`,
          channel: channelName,
        });
        send(ws, {
          type: "system",
          message: {
            id: data.id,
            result: `Connected to channel: ${channelName}`,
          },
          channel: channelName,
        });

        clients.forEach((client) => {
          if (client !== ws) {
            send(client, {
              type: "system",
              message: "A new user has joined the channel",
              channel: channelName,
            });
          }
        });
        return;
      }

      if (data.type === "message" || data.type === "progress_update") {
        const channelName = data.channel;
        const clients = channels.get(channelName);
        if (!clients || !clients.has(ws)) {
          send(ws, { type: "error", message: "You must join the channel first" });
          return;
        }

        clients.forEach((client) => {
          if (client !== ws) {
            send(
              client,
              data.type === "message"
                ? {
                    type: "broadcast",
                    message: data.message,
                    sender: "peer",
                    channel: channelName,
                  }
                : data,
            );
          }
        });
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  });

  ws.on("close", () => {
    channels.forEach((clients, channelName) => {
      if (clients.delete(ws)) {
        clients.forEach((client) => {
          send(client, {
            type: "system",
            message: "A user has left the channel",
            channel: channelName,
          });
        });
      }
    });
  });
});

server.on("listening", () => {
  console.log(`WebSocket server running on port ${port}`);
});

server.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
