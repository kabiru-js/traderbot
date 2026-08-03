import type { Server } from 'socket.io'

let io: Server | null = null

export function setIO(server: Server): void {
  io = server
}

/** Broadcasts an event to every socket belonging to a user. */
export function emitToUser(
  userId: string,
  event: string,
  payload: unknown,
): void {
  io?.to(`user:${userId}`).emit(event, payload)
}
