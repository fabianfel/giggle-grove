import { Injectable } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { WebSocketMessage } from './WebSocketMessage';
import { WebSocketService } from './WebSocketService';

@Injectable({
  providedIn: 'root',
})
export class MockWebSocketService extends WebSocketService {
  private subject = new Subject<WebSocketMessage>();

  override subscribe(
    next?: (value: WebSocketMessage) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Subscription {
    return this.subject.subscribe(next, error, complete);
  }

  override next(data: WebSocketMessage) {
    this.subject.next(data);
  }
}
