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
const DEFAULT_SERVER_ADDRESS = "localhost:3001";

export default class GRPCRouter {
  constructor(transport) {
    this.httpTransport = transport;
    this.serverAddress = DEFAULT_SERVER_ADDRESS;
    this.server = new grpc.Server();
  }

  startServer() {
    const self = this;
    this.server.addService(rpcDefinition.ZemuCommand.service, {
      Exchange: function (call, callback, ctx = self) {
        ctx.httpTransport.exchange(call.request.command).then((response) => {
          callback(null, { reply: response });
        });
      },
    });
    this.server.bind(this.serverAddress, grpc.ServerCredentials.createInsecure());
    this.server.start();
    console.log("grpc server started");
  }

  stopServer() {
    this.server.forceShutdown();
  }
}
