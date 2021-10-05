import { Server } from '@grpc/grpc-js'

const PROTO_PATH = `${__dirname}/zemu.proto`
const protoLoader = require('@grpc/proto-loader')
const grpc = require('@grpc/grpc-js')

export default class GRPCRouter {
  private httpTransport: any
  private serverAddress: string
  private server: Server

  constructor(ip: string, port: number, options: { debug?: any }, transport: any) {
    this.httpTransport = transport
    this.serverAddress = `${ip}:${port}`
    this.server = new grpc.Server()
  }

  async startServer() {
    const packageDefinition = await protoLoader.load(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    })

    const rpcDefinition = grpc.loadPackageDefinition(packageDefinition)

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    this.server.addService(rpcDefinition.ledger_go.ZemuCommand.service, {
      Exchange(call: any, callback: any, ctx = self) {
        ctx.httpTransport.exchange(call.request.command).then((response: any) => {
          callback(null, { reply: response })
        })
      },
    })
    this.server.bindAsync(
      this.serverAddress,
      grpc.ServerCredentials.createInsecure(),
      // eslint-disable-next-line no-unused-vars
      (err, port) => {
        if (err != null) {
          return console.error(err)
        }
        process.stdout.write(`gRPC listening on ${port}`)
        this.server.start()
      },
    )
    process.stdout.write(`grpc server started on ${this.serverAddress}`)
  }

  stopServer() {
    this.server.forceShutdown()
  }
}
