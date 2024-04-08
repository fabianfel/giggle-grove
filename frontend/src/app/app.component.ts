import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';
import { config } from '../environments/environment';
import { SortedDoubleLinkedList } from './messageHelper';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { timer } from 'rxjs';

@Component({
  selector: 'app-component',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements AfterViewInit {
  title: string = 'Hello, Angular!';
  value = 'Clear me';

  messageReceived: boolean = false;

  websocket: WebSocketSubject<{
    operation: string;
    payload: {
      groupname?: string;
      user?: string;
      msg?: string;
      timestamp?: number;
      received?: boolean;
    };
  }> = webSocket(config.websocketUrl); // Setzen Sie die WebSocket-Adresse entsprechend Ihrer Serverkonfiguration

  user: string = '';
  groupname: string = '';
  message: string = '';
  messages: SortedDoubleLinkedList<{
    sender?: string;
    msg?: string;
    groupname?: string;
    timestamp: number;
    received?: boolean;
  }> = new SortedDoubleLinkedList();

  isLoading: boolean = false;

  constructor() {
    this.websocket.subscribe({
      next: () => {
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = true;
      },
    });
  }

  @ViewChild('scrollframe', { static: false }) scrollFrame!: ElementRef;
  @ViewChildren('msg') msgElements!: QueryList<any>;

  private shouldScrollToBottom: boolean = true;

  ngAfterViewInit() {
    this.msgElements.changes.subscribe((_) => {
      if (this.shouldScrollToBottom) {
        this.scrollToBottom();
      }
    });
  }

  private scrollToBottom(): void {
    this.scrollFrame.nativeElement.scroll({
      top: this.scrollFrame.nativeElement.scrollHeight,
      left: 0,
      behavior: 'smooth',
    });
  }

  ngOnInit() {
    this.websocket.subscribe((msg) => {
      let messageFound;

      switch (msg.operation) {
        case 'NEW_MESSAGE':
          this.messages.insert({
            sender: msg.payload.user,
            msg: msg.payload.msg!,
            groupname: msg.payload.groupname,
            timestamp: msg.payload.timestamp || 0,
            received: false,
          });
          this.websocket.next({
            operation: 'ACKNOWLEDGE_MESSAGE',
            payload: {
              timestamp: msg.payload.timestamp,
            },
          });
          break;
        case 'GROUP_JOINED':
          document.getElementById('joined-user')!.innerHTML = this.user;
          document.getElementById('joined-gruppe')!.innerHTML = this.groupname;
          break;
        case 'placeholder':
          messageFound = this.messages.setReceivedAttributeByTimestamp(
            msg.payload.timestamp || 0,
            msg.payload.user || '',
            msg.payload.msg || ''
          );
          if (messageFound) {
            break;
          } else {
            throw new Error(
              `Message with timestamp ${msg.payload.timestamp} could not be found in the existing messages list and therefore couldn't be acknowledged.`
            );
          }
        default:
          throw new Error(`Unknown operation: ${msg.operation}`);
      }
    });
  }

  login() {
    if (this.user === '' || this.groupname === '') {
      alert('Bitte füllen Sie alle Felder aus.');
      return;
    }

    var message = {
      operation: 'CREATE_OR_JOIN_GROUP',
      payload: {
        user: this.user,
        groupname: this.groupname,
      },
    };

    this.websocket.next(message);
  }

  sendMessage() {
    var messageInput = this.message.trim();

    if (this.user === '' || this.groupname === '' || messageInput === '') {
      alert('Bitte füllen Sie alle Felder aus.');
      return;
    }

    var message = {
      operation: 'SEND_MESSAGE',
      payload: {
        user: this.user,
        groupname: this.groupname,
        msg: messageInput,
        timestamp: Date.now(),
        received: false,
      },
    };

    this.websocket.next(message);
  }
}
