import { resolve } from 'node:path'
import { credentials, loadPackageDefinition } from '@grpc/grpc-js'
import { loadSync } from '@grpc/proto-loader'

const PROTO_PATH = resolve('src/grpc/zemu.proto')

/** Minimal gRPC client for the ZemuCommand service used by the tests. */
export function exchangeViaGrpc(port: number, command: Buffer, timeoutMs = 5000): Promise<Buffer> {
  const definition = loadPackageDefinition(loadSync(PROTO_PATH, { keepCase: true })) as any
  const client = new definition.ledger_go.ZemuCommand(`127.0.0.1:${port}`, credentials.createInsecure())
  return new Promise((resolvePromise, reject) => {
    client.Exchange({ command }, { deadline: Date.now() + timeoutMs }, (err: Error | null, response: { reply: Buffer }) => {
      client.close()
      if (err) reject(err)
      else resolvePromise(Buffer.from(response.reply))
    })
  })
}
