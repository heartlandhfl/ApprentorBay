import { useEffect, useRef } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import type { SessionJoinPayload } from '@apprentorbay/shared';

type JitsiMeetingEmbedProps = {
  join: SessionJoinPayload;
  onLeave: () => void;
};

type JitsiExternalApi = {
  addListener: (event: string, listener: () => void) => void;
  removeListener: (event: string, listener: () => void) => void;
  executeCommand: (command: string) => void;
  dispose: () => void;
};

export function JitsiMeetingEmbed({ join, onLeave }: JitsiMeetingEmbedProps) {
  const apiRef = useRef<JitsiExternalApi | null>(null);
  const leaveHandled = useRef(false);

  useEffect(() => {
    return () => {
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, []);

  function handleLeave() {
    if (leaveHandled.current) return;
    leaveHandled.current = true;
    onLeave();
  }

  return (
    <div className="overflow-hidden rounded-sm border border-line bg-ink">
      <JitsiMeeting
        domain={join.domain}
        roomName={join.roomName}
        jwt={join.jwt}
        userInfo={join.userInfo}
        configOverwrite={{
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: true,
          disableDeepLinking: true,
        }}
        interfaceConfigOverwrite={{
          MOBILE_APP_PROMO: false,
          SHOW_JITSI_WATERMARK: false,
        }}
        onApiReady={(externalApi) => {
          apiRef.current = externalApi as JitsiExternalApi;
          externalApi.addListener('videoConferenceLeft', handleLeave);
          externalApi.addListener('readyToClose', handleLeave);
        }}
        getIFrameRef={(node) => {
          if (node) {
            node.style.height = 'min(70vh, 720px)';
            node.style.minHeight = '320px';
            node.style.width = '100%';
          }
        }}
      />
    </div>
  );
}
