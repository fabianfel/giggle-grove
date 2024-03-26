import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';
import { config } from '../environments/environment';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AfterViewInit } from '@angular/core';

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
  ],
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements AfterViewInit {
  title: string = 'Hello, Angular!';
  value = 'Clear me';

  websocket: WebSocketSubject<{
    operation: string;
    payload: { groupname: string; user: string; msg?: string };
  }> = webSocket(config.websocketUrl); // Setzen Sie die WebSocket-Adresse entsprechend Ihrer Serverkonfiguration

  user: string = '';
  groupname: string = '';
  message: string = '';
  messages: { sender: string; msg: string; groupname: string }[] = [];

  constructor(private elementRef: ElementRef) {
    // subject.subscribe(
    //   (msg) => console.log('message received: ' + msg), // Called whenever there is a message from the server.
    //   (err) => console.log(err), // Called if at any point WebSocket API signals some kind of error.
    //   () => console.log('complete') // Called when connection is closed (for whatever reason).
    // );
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
      switch (msg.operation) {
        case 'NEW_MESSAGE':
          console.log('New Message received in Group: ', msg);
          this.messages.push({
            sender: msg.payload.user,
            msg: msg.payload.msg!,
            groupname: msg.payload.groupname,
          });
          break;
        case 'GROUP_JOINED':
          document.getElementById('joined-user')!.innerHTML = this.user;
          document.getElementById('joined-gruppe')!.innerHTML = this.groupname;
          break;
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
      },
    };

    this.websocket.next(message);
  }
}
