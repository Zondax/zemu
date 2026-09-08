import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadPackageDefinition, Server, ServerCredentials, type ServiceDefinition } from '@grpc/grpc-js'
import { loadSync } from '@grpc/proto-loader'
import type Transport from '@ledgerhq/hw-transport'

// The build step copies zemu.proto next to the compiled router (dist/grpc/).
const PROTO_PATH = resolve(__dirname, 'zemu.proto')

export default class GRPCRouter {
  private readonly httpTransport: Transport
  private readonly serverAddress: string
  private readonly server: Server

  constructor(ip: string, port: number, transport: Transport) {
    this.httpTransport = transport
    this.serverAddress = `${ip}:${port}`
    this.server = new Server()
  }

  /** Resolves with the bound port once the server is listening. */
  async startServer(): Promise<number> {
    if (!existsSync(PROTO_PATH)) {
      throw new Error(`zemu.proto not found at ${PROTO_PATH}`)
    }

    const packageDefinition = loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    })

    const rpcDefinition = loadPackageDefinition(packageDefinition) as any
    const service = rpcDefinition.ledger_go.ZemuCommand.service as ServiceDefinition

    this.server.addService(service, {
      Exchange: (call: any, callback: (err: Error | null, reply?: { reply: Buffer }) => void) => {
        this.httpTransport
          .exchange(call.request.command)
          .then((response: Buffer) => callback(null, { reply: response }))
          .catch((err: unknown) => callback(err as Error))
      },
    })

    return await new Promise<number>((resolvePromise, reject) => {
      this.server.bindAsync(this.serverAddress, ServerCredentials.createInsecure(), (err, port) => {
        if (err != null) {
          reject(err)
          return
        }
        process.stdout.write(`gRPC listening on ${port}\n`)
        resolvePromise(port)
      })
    })
  }

  stopServer(): void {
    this.server.forceShutdown()
  }
}
