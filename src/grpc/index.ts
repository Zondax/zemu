import { Server } from '@grpc/grpc-js'

const PROTO_PATH = `${__dirname}/zemu.proto`
const protoLoader = require('@grpc/proto-loader')
const grpc = require('@grpc/grpc-js')

export default class GRPCRouter {
  private httpTransport: any
  private serverAddress: string
  private server: Server
  private debug_en: boolean
  constructor(ip: string, port: number, options: { debug?: any }, transport: any) {
    this.httpTransport = transport
    this.serverAddress = `${ip}:${port}`
    this.server = new grpc.Server()
    this.debug_en = options.debug
  }

  async startServer() {
    const self = this

    const packageDefinition = await protoLoader.load(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    })

    const rpcDefinition = grpc.loadPackageDefinition(packageDefinition)

    this.server.addService(rpcDefinition.ledger_go.ZemuCommand.service, {
      Exchange(call: any, callback: any, ctx = self) {
        ctx.httpTransport.exchange(call.request.command).then((response: any) => {
          if (self.debug_en) {
            const tmp = Buffer.from(call.request.command, 'hex')
            const x = tmp.slice(6, 6 + tmp[5]).toString('ascii')
          }

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
        console.log(`gRPC listening on ${port}`)
        this.server.start()
      },
    )

    console.log('grpc server started on', this.serverAddress)
  }

  stopServer() {
    this.server.forceShutdown()
  }
}
