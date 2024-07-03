import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'node:fs';
import ffmpeg from 'fluent-ffmpeg';
import installerfmmpeg from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(installerfmmpeg.path);

dotenv.config();

let assistant: OpenAI.Beta.Assistants.Assistant;

let openai: OpenAI;
const activeChats = new Map();

let didInit = false;

export async function initializeNewAIChatSession(
  chatId: string
): Promise<void> {
  if (!didInit) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY!,
    });
    assistant = await openai.beta.assistants.retrieve(
      process.env.OPENAI_ASSISTANT!
    );
    didInit = true;
  }
  if (activeChats.has(chatId)) return;
  const thread = await openai.beta.threads.create();
  activeChats.set(chatId, thread);
}

export async function mainOpenAI({
  currentMessage,
  chatId,
}: {
  currentMessage: string;
  chatId: string;
}): Promise<string> {
  const thread = activeChats.get(chatId) as OpenAI.Beta.Threads.Thread;
  await openai.beta.threads.messages.create(thread.id, {
    role: 'user',
    content: currentMessage,
  });

  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistant.id,
    instructions: assistant.instructions,
  });

  const messages = await checkRunStatus({ threadId: thread.id, runId: run.id });
  const responseAI = messages.data[0]
    .content[0] as OpenAI.Beta.Threads.Messages.TextContentBlock;
  return responseAI.text.value;
}

async function checkRunStatus({
  threadId,
  runId,
}: {
  threadId: string;
  runId: string;
}): Promise<OpenAI.Beta.Threads.Messages.MessagesPage> {
  return await new Promise((resolve, reject) => {
    const verify = async (): Promise<void> => {
      try {
        const runStatus = await openai.beta.threads.runs.retrieve(
          threadId,
          runId
        );

        switch (runStatus.status) {
          case 'completed': {
            const messages = await openai.beta.threads.messages.list(threadId);
            resolve(messages);
            break;
          }
          case 'in_progress':
          case 'queued':
            console.log(
              'Aguardando resposta da OpenAI... runStatus.status: ',
              runStatus.status
            );
            setTimeout(verify, 1000);
            break;
          case 'requires_action':
            reject(
              new Error(
                'OpenAI pediu por funções que não estão ativas no código para realizar.'
              )
            );
            break;
          case 'failed':
          case 'cancelled':
          case 'cancelling':
          case 'expired':
            console.log('runStatus.status:', runStatus.status);
            reject(new Error('Falha ao processar a mensagem na OpenAI.'));
            break;
          default:
            reject(
              new Error(
                'Falha ao processar a mensagem na OpenAI: Status desconhecido'
              )
            );
            break;
        }
      } catch (error) {
        console.error('Erro ao verificar o status do run:', error);
        reject(error);
      }
    };

    verify();
  });
}

export async function convertAndTranscriptionAudio({
  bufferAudio,
  messageId,
}: {
  bufferAudio: Buffer;
  messageId: string;
}): Promise<string> {
  return await new Promise((resolve, reject) => {
    const inputFilePath = `./input-audio-${messageId}.ogg`;
    const outputFilePath = `./output-audio-${messageId}.mp3`;
    fs.writeFile(inputFilePath, bufferAudio, {}, () => {
      ffmpeg(inputFilePath)
        .toFormat('mp3')
        .on('error', (err: any) => {
          console.error('An error occurred:', err);
          fs.unlink(inputFilePath, () => {});
          reject(err);
        })
        .on('end', () => {
          console.log('Conversion completed.');

          openai.audio.transcriptions
            .create({
              file: fs.createReadStream(outputFilePath),
              model: 'whisper-1',
              language: 'pt',
            })
            .then((transcription) => {
              fs.unlink(inputFilePath, () => {});
              fs.unlink(outputFilePath, () => {});
              resolve(transcription.text);
            });
        })
        .save(outputFilePath);
    });
  });
}

export async function transcriptionImage({
  bufferImage,
  messageId,
  caption,
}: {
  bufferImage: Buffer;
  messageId: string;
  caption: string | null | undefined;
}): Promise<string> {
  return await new Promise((resolve, reject) => {
    const inputFilePath = `./image-${messageId}.jpg`;
    fs.writeFile(inputFilePath, bufferImage, {}, async () => {
      try {
        const imageBuffer = fs.readFileSync(inputFilePath);
        const base64Image = imageBuffer.toString('base64');
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'O que tem na imagem?' },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
        });
        fs.unlink(inputFilePath, () => {});
        resolve(
          `Você recebeu uma imagem que já foi descrita por outro modelo, responda para o cliente com base na imagem recebida. aqui está a descrição dela: ${response.choices[0].message.content!} ${caption && `O cliente enviou junto com a imagem a seguinte mensagem: ${caption}`}`
        );
      } catch (err) {
        console.log('err', err);
      }
    });
  });
}
