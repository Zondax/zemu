import { loadPackageDefinition, Server, ServerCredentials } from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import type Transport from "@ledgerhq/hw-transport";
import { resolve } from "path";

const PROTO_PATH = resolve(__dirname, "zemu.proto");

export default class GRPCRouter {
  private readonly httpTransport: Transport;
  private readonly serverAddress: string;
  private readonly server: Server;

  constructor(ip: string, port: number, transport: any) {
    this.httpTransport = transport;
    this.serverAddress = `${ip}:${port}`;
    this.server = new Server();
  }

  startServer(): void {
    const packageDefinition = loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const rpcDefinition = loadPackageDefinition(packageDefinition);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    // @ts-expect-error types are missing
    this.server.addService(rpcDefinition.ledger_go.ZemuCommand.service, {
      Exchange(call: any, callback: any, ctx = self) {
        void ctx.httpTransport.exchange(call.request.command).then((response: Buffer) => {
          callback(null, { reply: response });
        });
      },
    });
    this.server.bindAsync(this.serverAddress, ServerCredentials.createInsecure(), (err, port) => {
      if (err != null) {
        console.error(err);
        return;
      }
      process.stdout.write(`gRPC listening on ${port}`);
      this.server.start();
    });
    process.stdout.write(`grpc server started on ${this.serverAddress}`);
  }

  stopServer(): void {
    this.server.forceShutdown();
  }
}
