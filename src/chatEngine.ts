// import { stdin as input, stdout as output } from 'node:process';
// import readline from 'node:readline/promises';

import {
  CompactAndRefine,
  Document,
  ResponseSynthesizer,
  VectorStoreIndex,
  type TextQaPrompt,
} from 'llamaindex';

// import {
//   ContextChatEngine,
//   Document,
//   Settings,
//   VectorStoreIndex,
// } from 'llamaindex';

// import essay from './essay';

// // Update chunk size
// Settings.chunkSize = 512;

// async function main(): Promise<void> {
//   const document = new Document({ text: essay });
//   const index = await VectorStoreIndex.fromDocuments([document]);
//   const retriever = index.asRetriever();
//   retriever.similarityTopK = 5;
//   const chatEngine = new ContextChatEngine({ retriever });
//   const rl = readline.createInterface({ input, output });

//   while (true) {
//     const query = await rl.question('Query: ');
//     const stream = await chatEngine.chat({ message: query, stream: true });
//     console.log();
//     for await (const chunk of stream) {
//       process.stdout.write(chunk.response);
//     }
//   }
// }

// main().catch(console.error);

// import fs from 'node:fs/promises';

// import {
//   Document,
//   MetadataMode,
//   type NodeWithScore,
//   VectorStoreIndex,
// } from 'llamaindex';

// async function main(): Promise<void> {
//   // Load essay from abramov.txt in Node
//   const path = 'node_modules/llamaindex/examples/abramov.txt';

//   const essay = await fs.readFile(path, 'utf-8');

//   // Create Document object with essay
//   const document = new Document({ text: essay, id_: path });

//   // Split text and create embeddings. Store them in a VectorStoreIndex
//   const index = await VectorStoreIndex.fromDocuments([document]);

//   // Query the index
//   const queryEngine = index.asQueryEngine();
//   const { response, sourceNodes } = await queryEngine.query({
//     query: 'Quais são os titulos de neymar?',
//   });

//   // Output response with sources
//   console.log(response);

//   if (sourceNodes) {
//     sourceNodes.forEach((source: NodeWithScore, index: number) => {
//       console.log(
//         `\n${index}: Score: ${source.score} - ${source.node.getContent(MetadataMode.ALL)}...\n`
//       );
//     });
//   }
// }

// main().catch(console.error);

// import {
//   Document,
//   Settings,
//   SimpleNodeParser,
//   SummaryIndex,
//   SummaryRetrieverMode,
// } from 'llamaindex';

// import essay from './essay';

// // Update node parser
// Settings.nodeParser = new SimpleNodeParser({
//   chunkSize: 40,
// });

// async function main(): Promise<void> {
//   const document = new Document({ text: essay, id_: 'essay' });
//   const index = await SummaryIndex.fromDocuments([document]);
//   const queryEngine = index.asQueryEngine({
//     retriever: index.asRetriever({ mode: SummaryRetrieverMode.LLM }),
//   });
//   const response = await queryEngine.query({
//     query: 'What did the author do growing up?',
//   });
//   console.log(response.toString());
// }

// main().catch((e: Error) => {
//   console.error(e, e.stack);
// });

import essay from './essay';

// Define a custom prompt
const newTextQaPrompt: TextQaPrompt = ({ context, query }) => {
  return `Context information is below.
---------------------
${context}
---------------------
Given the context information and not prior knowledge, answer the query.
Answer the query in the style of a Tony Stark.
Query: ${query}
Answer:`;
};

// Create an instance of response synthesizer
const responseSynthesizer = new ResponseSynthesizer({
  responseBuilder: new CompactAndRefine(undefined, newTextQaPrompt),
});
const document = new Document({ text: essay, id_: 'essay' });

// Create index
const index = await VectorStoreIndex.fromDocuments([document]);

// Query the index
const queryEngine = index.asQueryEngine({ responseSynthesizer });

const response = await queryEngine.query({
  query: 'Quem é Ralph Hazell?',
});

console.log('response', response);
