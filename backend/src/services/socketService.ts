import { Server, Socket } from 'socket.io';
import jwtService from './jwtService';

interface AuthenticatedSocket extends Socket {
  user?: any;
}

class SocketService {
  private io: Server | null = null;
  private connectedUsers: Map<number, string> = new Map(); // userId -> socketId

  initialize(server: any): void {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.io.use(this.authenticateSocket.bind(this));
    this.setupEventHandlers();
    
    console.log('✅ WebSocket server initialized');
  }

  private authenticateSocket(socket: AuthenticatedSocket, next: any): void {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwtService.verifyToken(token);
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`🔌 User ${socket.user.userId} connected with socket ID: ${socket.id}`);

      // Store user connection
      this.connectedUsers.set(socket.user.userId, socket.id);

      // Join user to their personal room for private messages
      socket.join(`user_${socket.user.userId}`);

      // Join runner to available runners room if they are a runner
      if (socket.user.userType === 'runner' || socket.user.userType === 'both') {
        socket.join('available_runners');
      }

      // Handle errand status updates
      socket.on('errand_status_update', (data) => {
        this.handleErrandStatusUpdate(socket, data);
      });

      // Handle location updates from runners
      socket.on('location_update', (data) => {
        this.handleLocationUpdate(socket, data);
      });

      // Handle typing indicators for chat
      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`🔌 User ${socket.user.userId} disconnected`);
        this.connectedUsers.delete(socket.user.userId);
      });
    });
  }

  // Real-time errand status updates
  async handleErrandStatusUpdate(socket: AuthenticatedSocket, data: any): Promise<void> {
    const { errandId, status, message } = data;
    
    // Emit to customer and runner involved in the errand
    this.io?.to(`errand_${errandId}`).emit('errand_status_updated', {
      errandId,
      status,
      message,
      updatedAt: new Date().toISOString(),
      updatedBy: socket.user.userId
    });

    console.log(`📦 Errand ${errandId} status updated to ${status} by user ${socket.user.userId}`);
  }

  // Real-time location tracking for runners
  async handleLocationUpdate(socket: AuthenticatedSocket, data: any): Promise<void> {
    const { errandId, latitude, longitude } = data;
    
    // Emit to customer tracking this errand
    this.io?.to(`errand_${errandId}`).emit('runner_location_updated', {
      errandId,
      latitude,
      longitude,
      timestamp: new Date().toISOString()
    });
  }

  // Typing indicators for in-app chat
  async handleTypingStart(socket: AuthenticatedSocket, data: any): Promise<void> {
    const { errandId, userId } = data;
    
    socket.to(`errand_${errandId}`).emit('user_typing', {
      errandId,
      userId,
      isTyping: true
    });
  }

  async handleTypingStop(socket: AuthenticatedSocket, data: any): Promise<void> {
    const { errandId, userId } = data;
    
    socket.to(`errand_${errandId}`).emit('user_typing', {
      errandId,
      userId,
      isTyping: false
    });
  }

  // Public methods to emit events from controllers

  // NEW: Add the missing method that was called in controller
  emitErrandStatusUpdate(data: {
    errandId: number;
    status: string;
    message: string;
    updatedBy: number;
  }): void {
    this.io?.to(`errand_${data.errandId}`).emit('errand_status_updated', {
      errandId: data.errandId,
      status: data.status,
      message: data.message,
      updatedAt: new Date().toISOString(),
      updatedBy: data.updatedBy
    });
  }

  emitErrandCreated(errand: any): void {
    this.io?.to('available_runners').emit('new_errand_available', {
      errand,
      createdAt: new Date().toISOString()
    });
  }

  emitErrandAccepted(errand: any): void {
    // Notify customer that their errand was accepted
    this.io?.to(`user_${errand.customer_id}`).emit('errand_accepted', {
      errand,
      acceptedAt: new Date().toISOString()
    });

    // Notify all runners that this errand is no longer available
    this.io?.to('available_runners').emit('errand_taken', {
      errandId: errand.id
    });
  }

  emitErrandCompleted(errand: any): void {
    this.io?.to(`user_${errand.customer_id}`).emit('errand_completed', {
      errand,
      completedAt: new Date().toISOString()
    });

    // Also emit status update for consistency
    this.emitErrandStatusUpdate({
      errandId: errand.id,
      status: errand.status,
      message: 'Errand completed successfully',
      updatedBy: errand.runner_id
    });
  }

  emitNewMessage(errandId: number, message: any): void {
    this.io?.to(`errand_${errandId}`).emit('new_message', {
      errandId,
      message,
      sentAt: new Date().toISOString()
    });
  }

  // Join a socket room for specific errand tracking
  joinErrandRoom(userId: number, errandId: number): void {
    const socketId = this.connectedUsers.get(userId);
    if (socketId && this.io) {
      this.io.sockets.sockets.get(socketId)?.join(`errand_${errandId}`);
    }
  }

  // Get connected users count (for monitoring)
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }
}

export default new SocketService();