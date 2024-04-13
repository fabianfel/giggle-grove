import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { AppComponent } from './app.component';
import { WebSocketService } from '../helperClasses/WebSocketService';
import { of } from 'rxjs';
import { WebSocketMessage } from '../helperClasses/WebSocketMessage';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let websocketServiceSpy: jasmine.SpyObj<WebSocketService>;

  beforeEach(async () => {
    // Erstelle ein Spy-Objekt für den WebSocketService
    const spy = jasmine.createSpyObj('WebSocketService', ['subscribe', 'next']);

    await TestBed.configureTestingModule({
      imports: [BrowserAnimationsModule],
      providers: [{ provide: WebSocketService, useValue: spy }],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    websocketServiceSpy = TestBed.inject(
      WebSocketService
    ) as jasmine.SpyObj<WebSocketService>;
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

  it('should throw an error for unknown operation', () => {
    const msg: WebSocketMessage = {
      operation: 'unknownOperation',
      payload: {},
    };

    expect(() => component.handleWebSocketMessage(msg)).toThrowError(
      'Unknown operation: unknownOperation'
    );
  });
});
