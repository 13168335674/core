import { Injectable, Autowired } from '@ali/common-di';
import { observable, action } from 'mobx';
import { DebugViewModel } from './debug-view-model';
import { DebugState, DebugSession } from '../debug-session';

@Injectable()
export class DebugToolbarService {

  @Autowired(DebugViewModel)
  protected readonly model: DebugViewModel;

  @observable
  state: DebugState;

  @observable
  sessionCount: number;

  @observable
  currentSession: DebugSession | undefined;

  @observable.shallow
  sessions: DebugSession[] = [];

  constructor() {
    this.model.onDidChange(() => {
      this.updateModel();
    });
  }

  @action
  updateModel() {
    this.state = this.model.state;
    this.currentSession = this.model.currentSession;
    this.sessions = this.model.sessions.filter((session: DebugSession) => {
      return session && session.state > DebugState.Inactive;
    });
    this.sessionCount = this.sessions.length;
  }

  doStart = () => {
    return this.model.start();
  }

  doRestart = () => {
    return this.model.restart();
  }

  doStop = () => {
    return this.model.currentSession && this.model.currentSession.terminate();
  }
  doContinue = () => {
    return this.model.currentThread && this.model.currentThread.continue();
  }
  doPause = () => {
    return this.model.currentThread && this.model.currentThread.pause();
  }
  doStepOver = () => {
    return this.model.currentThread && this.model.currentThread.stepOver();
  }
  doStepIn = () => {
    return this.model.currentThread && this.model.currentThread.stepIn();
  }
  doStepOut = () => {
    return this.model.currentThread && this.model.currentThread.stepOut();
  }

  updateCurrentSession = (session: DebugSession) => {
    this.model.currentSession = session;
  }

}
