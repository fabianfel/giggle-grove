import {
  Component,
  ElementRef,
  AfterViewInit,
  ViewChild,
  ViewChildren,
  QueryList,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { WebSocketService } from '../helperClasses/WebSocketService';
import { SortedDoubleLinkedList } from './messageHelper';
import { WebSocketMessage } from '../helperClasses/WebSocketMessage';

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
  providers: [WebSocketService],
})
export class AppComponent implements AfterViewInit {
  messageReceived: boolean = false;
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

  constructor(private websocketService: WebSocketService) {
    this.initializeWebSocketListener();
  }

  private initializeWebSocketListener(): void {
    this.websocketService.subscribe(
      (msg: WebSocketMessage) => {
        this.handleWebSocketMessage(msg);
      },
      (error: any) => {
        console.error('Error:', error);
      }
    );
  }

  handleWebSocketMessage(msg: WebSocketMessage): void {
    switch (msg.operation) {
      case 'NEW_MESSAGE':
        this.newMessage(msg);
        break;
      case 'GROUP_JOINED':
        this.groupJoined();
        break;
      case 'placeholder':
        this.messageConfirmation(msg);
        break;
      default:
        throw new Error(`Unknown operation: ${msg.operation}`);
    }
  }

  /**
   * Handles a new WebSocket message.
   *
   * @param msg - The WebSocket message to handle.
   */
  newMessage(msg: WebSocketMessage) {
    this.messages.insert({
      sender: msg.payload.user,
      msg: msg.payload.msg!,
      groupname: msg.payload.groupname,
      timestamp: msg.payload.timestamp || 0,
      received: false,
    });
    this.websocketService.next({
      operation: 'ACKNOWLEDGE_MESSAGE',
      payload: {
        timestamp: msg.payload.timestamp,
      },
    });
  }

  /**
   * Updates the joined user and group name in the HTML elements.
   *
   * @param msg - The WebSocket message.
   */
  groupJoined() {
    document.getElementById('joined-user')!.innerHTML = this.user;
    document.getElementById('joined-gruppe')!.innerHTML = this.groupname;
  }

  /**
   * Handles the confirmation of a WebSocket message.
   * @param msg - The WebSocket message to be confirmed.
   * @throws Error - If the message with the specified timestamp cannot be found in the existing messages list.
   */
  messageConfirmation(msg: WebSocketMessage) {
    let messageFound;

    messageFound = this.messages.setReceivedAttributeByTimestamp(
      msg.payload.timestamp || 0,
      msg.payload.user || '',
      msg.payload.msg || ''
    );
    if (!messageFound) {
      throw new Error(
        `Message with timestamp ${msg.payload.timestamp} could not be found in the existing messages list and therefore couldn't be acknowledged.`
      );
    }
  }

  // Start of code for the scrollable chat window

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

  // End of code for the scrollable chat window

  /**
   * Initializes the component and subscribes to the websocket messages.
   * The following operations are supported:
   * - NEW_MESSAGE: Inserts a new message into the messages list. And sends an ACKNOWLEDGE_MESSAGE message to the server.
   * - GROUP_JOINED: Displays the user and groupname in the chat window.
   * - placeholder: Sets the received attribute of a message to true.
   * @throws Error if the operation is unknown or if a message with a specific timestamp could not be found.
   */
  ngOnInit() {
    // No need to subscribe to WebSocket here since it's already subscribed in the constructor
  }

  /**
   * Logs in the user and sends a WebSocket message to create or join a group.
   * Displays an alert if any required fields are empty.
   */
  login() {
    this.messages.clear();

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

    this.websocketService.next(message);
  }

  /**
   * Sends a message to the server. Displays an alert if any required fields are empty.
   */
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

    this.websocketService.next(message);
  }
}
