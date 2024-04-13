import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flush,
  tick,
} from '@angular/core/testing';
import { AppComponent } from './app.component';
import { WebSocketService } from '../helperClasses/WebSocketService';
import { of } from 'rxjs';
import { WebSocketMessage } from '../helperClasses/WebSocketMessage';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MockWebSocketService } from '../helperClasses/MockWebSocketService';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let service: WebSocketService;
  let mockWebSocketService: MockWebSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BrowserAnimationsModule],
      providers: [
        { provide: WebSocketService, useClass: MockWebSocketService },
      ],
    });
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;

    service = TestBed.inject(WebSocketService);
    mockWebSocketService = TestBed.inject(
      WebSocketService
    ) as MockWebSocketService;
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  it('should add new message to messages', () => {
    const msg: WebSocketMessage = {
      operation: 'NEW_MESSAGE',
      payload: {
        user: 'testUser',
        msg: 'Test message',
        groupname: 'testGroup',
        timestamp: 123456789,
      },
    };

    component.newMessage(msg);
    expect(component.messages.getAllData().length).toBe(1);
    expect(component.messages.getAllData()[0]).toEqual({
      sender: 'testUser',
      msg: 'Test message',
      groupname: 'testGroup',
      timestamp: 123456789,
      received: false,
    });
  });

  it('should update group information', () => {
    component.user = 'testUser';
    component.groupname = 'testGroup';
    component.groupJoined();
    expect(document.getElementById('joined-user')!.innerHTML).toBe('testUser');
    expect(document.getElementById('joined-gruppe')!.innerHTML).toBe(
      'testGroup'
    );
  });

  it('should confirm message', () => {
    const msg: WebSocketMessage = {
      operation: 'placeholder',
      payload: { timestamp: 123456789, user: 'testUser', msg: 'Test message' },
    };
    component.messages.insert({
      sender: 'testUser',
      msg: 'Test message',
      groupname: 'testGroup',
      timestamp: 123456789,
      received: false,
    });
    component.messageConfirmation(msg);
    expect(component.messages.getAllData()[0].received).toBe(true);
  });

  it('should handle NEW_MESSAGE operation', () => {
    const msg: WebSocketMessage = {
      operation: 'NEW_MESSAGE',
      payload: {
        user: 'testUser',
        msg: 'Test message',
        groupname: 'testGroup',
        timestamp: 123456789,
      },
    };

    spyOn(component, 'newMessage');
    component.handleWebSocketMessage(msg);
    expect(component.newMessage).toHaveBeenCalledWith(msg);
  });

  it('should handle GROUP_JOINED operation', () => {
    spyOn(component, 'groupJoined');
    component.handleWebSocketMessage({
      operation: 'GROUP_JOINED',
      payload: {},
    });
    expect(component.groupJoined).toHaveBeenCalled();
  });

  it('should handle placeholder operation', () => {
    const msg: WebSocketMessage = {
      operation: 'placeholder',
      payload: { timestamp: 123456789, user: 'testUser', msg: 'Test message' },
    };

    spyOn(component, 'messageConfirmation');
    component.handleWebSocketMessage(msg);
    expect(component.messageConfirmation).toHaveBeenCalledWith(msg);
  });

  it('should throw error while handling placeholder operation', () => {
    const msg: WebSocketMessage = {
      operation: 'placeholder',
      payload: { timestamp: 123456789, user: 'testUser', msg: 'Test message' },
    };

    expect(() => component.messageConfirmation(msg)).toThrowError(
      "Message with timestamp 123456789 could not be found in the existing messages list and therefore couldn't be acknowledged."
    );
  });

  it('should throw an error for unknown operation', () => {
    const msg: WebSocketMessage = {
      operation: 'unknownOperation',
      payload: {},
    };

    expect(() => component.handleWebSocketMessage(msg)).toThrowError(
      'Unknown operation: unknownOperation'
    );
  });

  it('should send SEND_MESSAGE to WebSocketService', fakeAsync(() => {
    // Arrange
    const message: WebSocketMessage = {
      operation: 'SEND_MESSAGE',
      payload: {
        user: 'testUser',
        groupname: 'testGroup',
        msg: 'testMessage',
        timestamp: 0,
        received: false,
      },
    };
    let receivedMessage: WebSocketMessage | undefined;

    mockWebSocketService.subscribe((msg: WebSocketMessage) => {
      receivedMessage = msg;
    });

    component.sendMessage();

    service.next(message);
    tick();

    expect(receivedMessage).toEqual(message);
  }));

  it('should send CREATE_OR_JOIN_GROUP to WebSocketService', fakeAsync(() => {
    // Arrange
    const message: WebSocketMessage = {
      operation: 'CREATE_OR_JOIN_GROUP',
      payload: {
        user: 'testUser',
        groupname: 'testGroup',
        msg: 'testMessage',
        timestamp: 0,
        received: false,
      },
    };
    let receivedMessage: WebSocketMessage | undefined;

    mockWebSocketService.subscribe((msg: WebSocketMessage) => {
      receivedMessage = msg;
    });

    component.login();

    service.next(message);
    tick();

    expect(receivedMessage).toEqual(message);
  }));
});
