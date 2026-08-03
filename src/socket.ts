import { io, type Socket } from 'socket.io-client'
import { getToken } from './api'

let socket: Socket | null = null

/** Lazily creates the Socket.IO connection (same-origin via the Vite proxy). */
export function getSocket(): Socket {
  if (!socket || !socket.connected) {
    socket?.disconnect()
    socket = io({ auth: { token: getToken() } })
  }
  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}
