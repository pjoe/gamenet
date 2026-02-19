import mqtt from "mqtt";
import { SignalServer } from "./signal_server";

export function createMqttSignalServer(
  brokerUrl: string,
  topicPrefix = "pjoe.gamenet/"
): SignalServer {
  let client: mqtt.MqttClient | null = null;
  let currentTopic: string | null = null;
  let messageHandler: ((message: string) => void) | null = null;

  const ensureConnected = (): mqtt.MqttClient => {
    if (client && client.connected) {
      return client;
    }

    if (!client) {
      console.debug("Connecting to MQTT broker at:", brokerUrl);
      client = mqtt.connect(brokerUrl, {
        reconnectPeriod: 5000,
      });

      client.on("error", (err) => {
        console.error(`MQTT connection error: ${err.message}`);
      });

      client.on("message", (_topic: string, payload: Buffer) => {
        if (messageHandler) {
          const messageStr = payload.toString();
          messageHandler(messageStr);
        }
      });
    }

    return client;
  };

  const subscribe = (
    to: string,
    onMessage: (message: string) => void
  ): void => {
    const mqttClient = ensureConnected();

    // Unsubscribe from previous topic if exists
    if (currentTopic) {
      mqttClient.unsubscribe(currentTopic);
    }

    currentTopic = topicPrefix + to;
    messageHandler = onMessage;

    mqttClient.subscribe(currentTopic, (err) => {
      if (err) {
        console.error(
          `Failed to subscribe to topic ${currentTopic}: ${err.message}`
        );
      }
    });
  };

  const send = async (
    from: string,
    to: string,
    t: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any
  ): Promise<void> => {
    const mqttClient = ensureConnected();
    const topic = topicPrefix + to;
    const message = JSON.stringify({ from, to, t, data });

    return new Promise((resolve, reject) => {
      mqttClient.publish(topic, message, (err) => {
        if (err) {
          reject(
            new Error(`Failed to publish to topic ${topic}: ${err.message}`)
          );
        } else {
          resolve();
        }
      });
    });
  };

  const unsubscribe = (): void => {
    if (client) {
      if (currentTopic) {
        client.unsubscribe(currentTopic);
        currentTopic = null;
      }
      client.end();
      client = null;
    }
    messageHandler = null;
  };

  return {
    send,
    subscribe,
    unsubscribe,
  };
}
