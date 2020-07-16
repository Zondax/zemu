const PROTO_PATH = `${__dirname}/zemu.proto`;
const protoLoader = require("@grpc/proto-loader");
const grpc = require("@grpc/grpc-js");

export default class GRPCRouter {
  constructor(ip, port, options = {}, transport) {
    this.httpTransport = transport;
    this.serverAddress = `${ip}:${port}`;
    this.server = new grpc.Server();
    this.debug_en = false;

    if ("debug" in options) {
      this.debug_en = options.debug;
    }
  }

  async startServer() {
    const self = this;

    const packageDefinition = await protoLoader.load(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const rpcDefinition = grpc.loadPackageDefinition(packageDefinition);

    this.server.addService(rpcDefinition.ledger_go.ZemuCommand.service, {
      Exchange(call, callback, ctx = self) {
        ctx.httpTransport.exchange(call.request.command).then((response) => {
          if (self.debug_en) {
            let x = Buffer.from(call.request.command, "hex");
            x = x.slice(6, 6 + x[5]).toString("ascii");
            if (x.includes("oasis-")) {
              console.log(x);
            }
          }

          callback(null, { reply: response });
        });
      },
    });
    this.server.bindAsync(
      this.serverAddress,
      grpc.ServerCredentials.createInsecure(),
      // eslint-disable-next-line no-unused-vars
      (err, port) => {
        if (err != null) {
          return console.error(err);
        }
        console.log(`gRPC listening on ${port}`);
        this.server.start();
      },
    );

    console.log("grpc server started on", this.serverAddress);
  }

  stopServer() {
    this.server.forceShutdown();
  }
}
