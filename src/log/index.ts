import winston from 'winston';
import { LoggingWinston } from '@google-cloud/logging-winston';
import os from 'os';

export function startLogging(): void {
  const loggingWinston = new LoggingWinston({
    projectId: 'zap-gpt-417923',
    credentials: {
      type: 'service_account',
      project_id: 'zap-gpt-417923',
      private_key_id: '75a70cd6d70a697c60f150f8384e860253ab61ab',
      private_key:
        '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDPviiL409WDqyk\n1KQylZxIyn2asO3ciXbyGyNBVVyKvb5n5j4FJ1y9nsEfFsS9wPFHdKNk8QnrTnTI\nkviR0wsMv+JD1t0mkNfbVnQYz8RJ4b+YIFZyYRXjPPQA2653E0K8wQ/Eec29+HYb\nTNzzWto3r50a+EKN4eA7On/Kjfeum49XpNcSKAcTH2iajx40fgxMMtS9iv+p5V+9\n6NZvBvz2jJ90xJSCmVInXGyE1iIQUaHYCF/nhdIh93ezqm79SzfeqgSr97HGmQqP\noB8cG6p0XiX7A5W6L8GLJJGnzmGWSsfz3g0Z/33FLnn6xovTED2rwyYzd97r+hdZ\nU4GiqfWbAgMBAAECggEAMFn0ivaJkSCSOz0IyIM84E5M5LO4cQOHrTr2vi6Vfu9B\nwWH73mw2cCXikg9VFEszfSufGg/l/KACm2pls18Y68s/aQW57E97BiB9ngbBi2ah\nFtGz/SQumXim3ApFdY6EknUm69Zjtgr9xkXiCTwEnUBhAxV0PByt+WsYsjbPxpIf\nxe8zJdFvfauPNlYHNyAqknKx2HqakhkUVxo2F42RCgVIVIi9LCUupk5/Njrromkt\n0oI6M3LRCDDEGUjKjiW1e1DeeBz0F7a/JkrHkqH+nrBrfDTquZQaWrGsRrdd0psP\nI7x/QMp+paDHY6i1CVDTZuGbTUeI1TzMnp26zNfNsQKBgQD0m+NfsRbE+NjyDJ+S\nrDfA40D0xTaHzHh50ASPdgkoFATOOpzq220duE66mncKrJkHYLPrAPEBx+XaI4ha\nA4pyJnC9qX03fcJ1DkzNSdtTQrXyMVZzxDWk0qL65XO/M7g0tt7LA6PzGoWZTUIJ\ngVNBdZIZw2jIi22CaJq7bIls0QKBgQDZasUIBgBTzG9ICsFoWj2fcM/ETwYIKX3x\nPxIEITfBtXRNFsq7SRkKwv/w49lZglYkTVI2bEQp0EzfG7pU+GfruXFpbpZvTBaj\nhLM2NM79/TN04xZje1zwsZ/su227ldJQIFienaIQpL6x/zDM5xe+g4cVb3L4QWOk\nWTt07hNmqwKBgE1cbBnckR30sfBDi8hAjVWEygtfv/JM+aFU58xTgWvagPaUVQJ2\nKVln7AZaSeHnWnKZ4+0kHBT7GrfV2w7U5dlaTPe+/eop7PFGd4XJoQMBKzgQ4I22\ndVzOfVsqbGQBQHXzjBza5uRA9BXa+FK3QxSF0ZIyWhZq+lRvLtit5/yxAoGBALLR\nfAhjVzWU+RnZrsUzI2fVkyy0ihOAfNNEun6nC4LIyUT2L/vl3TDavULVQ9i4uDzX\nU3zrgwyZBACkf5aPUHmyZjL+/7++ZwhKhlNZD74a2I2UkL91oTVeAljktxYH3ZiF\nYh3jLH5f4W/ooayFjSPmbd4Vcgv5TAjKU3qSrWZNAoGBAON7L3JtcPkMRW/H6FBH\n6+s66b+Z3SYWkx4EX/td9rNKRu27Vuu77c3gKJTYvVhCSfmWyyxBdcsB1Qnew6th\n8gd/cwTPQxPuT4QX50bXL668Vl4gFlLsCc14CCy/xPOuSkxGEG2Z66ZSl12JOG0W\nMOfS4PIFfRoosqE9hMD2Uxjb\n-----END PRIVATE KEY-----\n',
      client_email: 'zap-gpt-public@zap-gpt-417923.iam.gserviceaccount.com',
      client_id: '116791369962699597035',
      universe_domain: 'googleapis.com',
    },
  });

  const logger = winston.createLogger({
    level: 'info',
    transports: [loggingWinston],
  });

  console.log = (...args) => {
    console.info(...args);
    const message = args
      .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
      .join(' ');
    logger.info(message, { computerId: os.hostname() });
  };
}
