export const validateConfig = (): void => {
  if (!process.env.AI_SELECTED) {
    throw Error('Você precisa selecionar uma IA no .env!');
  }

  if (process.env.AI_SELECTED === 'GEMINI' && !process.env.GEMINI_KEY) {
    throw Error('Você precisa colocar uma key do Gemini no .env!');
  }

  if (
    process.env.AI_SELECTED === 'GPT' &&
    (!process.env.OPENAI_KEY || !process.env.OPENAI_ASSISTANT)
  ) {
    throw Error(
      'Para utilizar o GPT você precisa configurar a sua key da OpenAI e o id do seu assistente no .env.'
    );
  }
};
