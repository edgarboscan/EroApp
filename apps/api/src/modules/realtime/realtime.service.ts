import { EventEmitter } from 'events';

export interface RealtimePayload {
  event: string;
  data: any;
  timestamp: string;
}

class RealtimeManager {
  private emitter = new EventEmitter();
  // Conteo de conexiones SSE activas por ID de usuario (permite múltiples pestañas/dispositivos)
  private userConnections = new Map<string, number>();
  // Mapa de usuarios actualmente conectados por empresa (companyId -> Set<userId>)
  private companyUsers = new Map<string, Set<string>>();

  constructor() {
    // Permitir suficientes suscriptores simultáneos para múltiples conexiones SSE de usuarios
    this.emitter.setMaxListeners(2000);
  }

  /**
   * Registra una conexión SSE entrante para un usuario
   */
  registerConnection(companyId: string, userId: string): { isFirstConnection: boolean } {
    const currentCount = this.userConnections.get(userId) || 0;
    const newCount = currentCount + 1;
    this.userConnections.set(userId, newCount);

    if (!this.companyUsers.has(companyId)) {
      this.companyUsers.set(companyId, new Set());
    }
    const companySet = this.companyUsers.get(companyId)!;
    const isFirstConnection = currentCount === 0;

    if (isFirstConnection) {
      companySet.add(userId);
      // Notificar a toda la empresa que este usuario se conectó
      this.emitToCompany(companyId, 'presence:update', {
        userId,
        isOnline: true,
        timestamp: new Date().toISOString(),
      });
    }

    return { isFirstConnection };
  }

  /**
   * Desregistra una conexión SSE al cerrarse o abortarse
   */
  unregisterConnection(companyId: string, userId: string): { isLastConnection: boolean } {
    const currentCount = this.userConnections.get(userId) || 0;
    const newCount = Math.max(0, currentCount - 1);

    if (newCount === 0) {
      this.userConnections.delete(userId);
      const companySet = this.companyUsers.get(companyId);
      if (companySet) {
        companySet.delete(userId);
        if (companySet.size === 0) {
          this.companyUsers.delete(companyId);
        }
      }
      // Notificar a toda la empresa que este usuario se desconectó
      this.emitToCompany(companyId, 'presence:update', {
        userId,
        isOnline: false,
        timestamp: new Date().toISOString(),
      });
      return { isLastConnection: true };
    } else {
      this.userConnections.set(userId, newCount);
      return { isLastConnection: false };
    }
  }

  /**
   * Verifica si un usuario tiene al menos una conexión en tiempo real activa
   */
  isUserOnline(userId: string): boolean {
    return (this.userConnections.get(userId) || 0) > 0;
  }

  /**
   * Obtiene la lista de IDs de usuarios actualmente conectados en una empresa
   */
  getOnlineUserIds(companyId: string): string[] {
    const companySet = this.companyUsers.get(companyId);
    return companySet ? Array.from(companySet) : [];
  }

  /**
   * Emite un evento en tiempo real dirigido a un usuario específico
   */
  emitToUser(userId: string, event: string, data: any): void {
    const payload: RealtimePayload = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    this.emitter.emit(`user:${userId}`, payload);
  }

  /**
   * Emite un evento en tiempo real a todos los usuarios de una empresa
   */
  emitToCompany(companyId: string, event: string, data: any): void {
    const payload: RealtimePayload = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    this.emitter.emit(`company:${companyId}`, payload);
  }

  /**
   * Suscribe a los eventos dirigidos a un usuario
   */
  subscribeUser(userId: string, handler: (payload: RealtimePayload) => void): () => void {
    const channel = `user:${userId}`;
    this.emitter.on(channel, handler);
    return () => {
      this.emitter.off(channel, handler);
    };
  }

  /**
   * Suscribe a los eventos globales de la empresa
   */
  subscribeCompany(companyId: string, handler: (payload: RealtimePayload) => void): () => void {
    const channel = `company:${companyId}`;
    this.emitter.on(channel, handler);
    return () => {
      this.emitter.off(channel, handler);
    };
  }
}

export const RealtimeService = new RealtimeManager();

