import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { apiRequest } from "../api.js";

function ParticipantVideo({ participant, track }) {
  const host = useRef(null);

  useEffect(() => {
    const element = track.attach();
    element.autoplay = true;
    element.playsInline = true;
    host.current?.appendChild(element);
    return () => {
      track.detach(element);
      element.remove();
    };
  }, [track]);

  return <div className="live-video-tile" ref={host}><span>{participant.name ?? participant.identity}</span></div>;
}

function ParticipantAudio({ track }) {
  const host = useRef(null);
  useEffect(() => {
    const element = track.attach();
    element.autoplay = true;
    host.current?.appendChild(element);
    return () => {
      track.detach(element);
      element.remove();
    };
  }, [track]);
  return <div ref={host} className="live-audio-tracks" aria-hidden="true" />;
}

export function LiveClassDialog({ lessonId, token, user, onClose }) {
  const [roomInfo, setRoomInfo] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState("");
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const roomRef = useRef(null);
  const messagesEnd = useRef(null);

  useEffect(() => {
    let active = true;
    let room;
    const addTrack = (track, participant) => {
      setTracks((current) => current.some((item) => item.track.sid === track.sid)
        ? current
        : [...current, { track, participant }]);
    };
    const removeTrack = (track) => {
      setTracks((current) => current.filter((item) => item.track.sid !== track.sid));
    };
    const load = async () => {
      const result = await apiRequest(`/lessons/${lessonId}/live-token`, { token });
      if (!active) return;
      setRoomInfo(result);
      room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => addTrack(track, participant));
      room.on(RoomEvent.TrackUnsubscribed, (track) => removeTrack(track));
      room.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
        if (publication.track) addTrack(publication.track, participant);
      });
      room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
        if (topic !== "chat") return;
        setMessages((current) => [...current, {
          id: `${Date.now()}-${Math.random()}`,
          author: participant?.name ?? "Participant",
          text: new TextDecoder().decode(payload),
        }]);
      });
      room.on(RoomEvent.Disconnected, () => setConnectionStatus("disconnected"));
      await room.connect(result.url, result.token);
      await room.localParticipant.enableCameraAndMicrophone();
      const localVideo = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      const localAudio = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
      if (localVideo) addTrack(localVideo, room.localParticipant);
      if (localAudio) addTrack(localAudio, room.localParticipant);
      if (active) setConnectionStatus("connected");
    };
    load().catch((loadError) => {
      if (active) {
        setError(loadError.message);
        setConnectionStatus("failed");
      }
    });
    return () => {
      active = false;
      room?.removeAllListeners();
      room?.disconnect();
      roomRef.current = null;
    };
  }, [lessonId, token]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function updateStatus(status) {
    setError("");
    try {
      const payload = await apiRequest(`/lessons/${lessonId}/live-status`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setRoomInfo((current) => ({ ...current, status: payload.liveClass.status }));
    } catch (statusError) {
      setError(statusError.message);
    }
  }

  async function sendChat(event) {
    event.preventDefault();
    const text = chatMessage.trim();
    if (!text || !roomRef.current) return;
    try {
      await roomRef.current.localParticipant.publishData(new TextEncoder().encode(text), {
        reliable: true,
        topic: "chat",
      });
      setMessages((current) => [...current, {
        id: `${Date.now()}-${Math.random()}`,
        author: user.name,
        text,
      }]);
      setChatMessage("");
    } catch (sendError) {
      setError(sendError.message);
    }
  }

  return <div className="portal-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="portal-modal live-class-modal" role="dialog" aria-modal="true" aria-label="Live class">
      <div className="portal-modal-heading">
        <h2>Live class</h2>
        <button aria-label="Close" onClick={onClose}>×</button>
      </div>
      {error && <p className="portal-error" role="alert">{error}</p>}
      <p className="live-connection-status" role="status">Room status: {connectionStatus}</p>
      {roomInfo && user.roles.some((role) => ["instructor", "admin"].includes(role)) && (
        <div className="live-host-controls">
          {roomInfo.status === "scheduled" && <button className="dialog-primary" onClick={() => updateStatus("live")}>Start class</button>}
          {roomInfo.status === "live" && <button className="portal-secondary" onClick={() => updateStatus("ended")}>End class</button>}
        </div>
      )}
      {roomInfo?.status === "ended" ? <p>This live class has ended. Mark the lesson complete in the course outline.</p> : (
        <div className="live-class-layout">
          <div className="live-video-grid">
            {tracks.filter(({ track }) => track.kind === Track.Kind.Video).map(({ participant, track }) => (
              <ParticipantVideo key={track.sid} participant={participant} track={track} />
            ))}
          </div>
          <div className="live-chat-panel">
            <h3>Class chat</h3>
            <div className="live-chat-messages" aria-live="polite">
              {messages.map((message) => <p key={message.id}><strong>{message.author}</strong><span>{message.text}</span></p>)}
              <div ref={messagesEnd} />
            </div>
            <form onSubmit={sendChat}>
              <input aria-label="Chat message" maxLength="1000" value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Write a message…" />
              <button className="dialog-primary" disabled={!chatMessage.trim()}>Send</button>
            </form>
          </div>
          {tracks.filter(({ track }) => track.kind === Track.Kind.Audio).map(({ track }) => <ParticipantAudio key={track.sid} track={track} />)}
        </div>
      )}
    </section>
  </div>;
}
