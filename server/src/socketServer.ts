import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { config } from './config'
import { verifyToken } from './auth'
import { setIO } from './realtime'

/** Socket.IO server with JWT auth. Users are joined to `user:{id}` rooms. */
export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') },
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (typeof token !== 'string') {
      next(new Error('unauthorized'))
      return
    }
    const user = verifyToken(token)
    if (!user) {
      next(new Error('unauthorized'))
      return
    }
    socket.data.userId = user.id
    next()
  })

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId as string}`)
  })

  setIO(io)
  return io
}
