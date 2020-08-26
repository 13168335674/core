import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, ViewState } from '@ali/ide-core-browser';
import { DebugStackSessionView } from './debug-call-stack-session.view';
import { DebugSessionManager } from '../../debug-session-manager';
import { IDebugSessionManager } from '../../../common';
import { DebugSession } from '../../debug-session';

export const DebugCallStackView = observer(({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const manager = useInjectable<DebugSessionManager>(IDebugSessionManager);
  const [sessions, setSessions] = React.useState<DebugSession[]>([]);

  React.useEffect(() => {
    const createDispose = manager.onDidCreateDebugSession((session) => {
      sessions.push(session);
      setSessions([...sessions]);
    });

    const destroyDispose = manager.onDidDestroyDebugSession((session) => {
      const index = sessions.findIndex((s) => s.id === session.id);
      sessions.splice(index, 1);
      setSessions([...sessions]);
    });

    return () => {
      createDispose.dispose();
      destroyDispose.dispose();
    };
  }, []);

  return (
    <div style={{ width: viewState.width }}>
      {
        sessions.map((session) => {
          return (
            <DebugStackSessionView key={session.id} viewState={ viewState } session={ session } />
          );
        })
      }
    </div>
  );
});
