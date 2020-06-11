const PROTO_PATH = `${__dirname}/zemu.proto`;
const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const rpcDefinition = grpc.loadPackageDefinition(packageDefinition).ledger_go;

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

  startServer() {
    const self = this;
    this.server.addService(rpcDefinition.ZemuCommand.service, {
      Exchange: function (call, callback, ctx = self) {
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
    this.server.bind(this.serverAddress, grpc.ServerCredentials.createInsecure());
    this.server.start();
    console.log("grpc server started on", this.serverAddress);
  }

  stopServer() {
    this.server.forceShutdown();
  }
}
