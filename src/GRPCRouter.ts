import * as protoLoader from "@grpc/proto-loader";
import * as grpc from "@grpc/grpc-js";
import type Transport from "@ledgerhq/hw-transport";

const PROTO_PATH = `${__dirname}/protos/zemu.proto`;

// waiting on support to compile proto type declarations https://github.com/grpc/grpc-node/pull/1474
interface ExchangeRequest {
  command: Buffer;
}

interface ExchangeReply {
  reply: Buffer;
}

export default class GRPCRouter {
  serverAddress: string;
  server: grpc.Server;
  debug_en: boolean;
  transport: Transport;

  constructor(
    ip: string,
    port: number,
    options: { debug?: boolean } = { debug: false },
    transport: Transport,
  ) {
    this.transport = transport;
    this.serverAddress = `${ip}:${port}`;
    this.server = new grpc.Server();
    this.debug_en = options.debug ?? false;
  }

  async startServer(): Promise<void> {
    const self: GRPCRouter = this;

    const packageDefinition = await protoLoader.load(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const rpcDefinition = grpc.loadPackageDefinition(packageDefinition);

    // waiting on support for typescript https://github.com/grpc/grpc-node/pull/1474
    this.server.addService((rpcDefinition.ledger_go as any).ZemuCommand.service, {
      async Exchange(
        call: grpc.ServerUnaryCall<ExchangeRequest, ExchangeReply>,
        callback: grpc.sendUnaryData<ExchangeReply>,
        ctx: GRPCRouter = self,
      ) {
        if (!call.request?.command) {
          callback(new Error("empty request"), { reply: Buffer.alloc(0) });
          return;
        }

        try {
          const response = await ctx.transport.exchange(call.request.command);
          if (ctx.debug_en) {
            const x = call.request.command;
            const str = x.slice(6, 6 + x[5]).toString("ascii");
            if (str.includes("oasis-")) {
              console.log(str);
            }
          }
          callback(null, { reply: response });
        } catch (err) {
          callback(new Error("empty request"), { reply: Buffer.alloc(0) });
        }
      },
    });
    this.server.bindAsync(this.serverAddress, grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err != null) {
        return console.error(err);
      }
      console.log(`gRPC listening on ${port}`);
      this.server.start();
    });

    console.log("grpc server started on", this.serverAddress);
  }

  stopServer() {
    this.server.forceShutdown();
  }
}
