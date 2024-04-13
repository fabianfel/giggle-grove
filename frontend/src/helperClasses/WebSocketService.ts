import { Injectable } from '@angular/core';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';
import { config } from '../environments/environment';
import { WebSocketMessage } from './WebSocketMessage';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private websocket: WebSocketSubject<any>;

  constructor() {
    this.websocket = webSocket(config.websocketUrl);
  }

  subscribe(
    next?: (value: WebSocketMessage) => void,
    error?: (error: any) => void,
    complete?: () => void
  ) {
    return this.websocket.subscribe(next, error, complete);
  }

  next(data: any) {
    this.websocket.next(data);
  }
}
