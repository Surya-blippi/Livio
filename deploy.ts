import { deploySite, getOrCreateBucket } from '@remotion/lambda';
import dotenv from 'dotenv';
import path from 'path';
import { VERSION } from 'remotion/version';

dotenv.config({ path: '.env.local' });

const start = async () => {
    const region = process.env.REMOTION_AWS_REGION || 'eu-north-1';

    console.log(`Deploying to region: ${region}`);

    const { bucketName } = await getOrCreateBucket({
        region: region as any,
    });

    console.log(`Using bucket: ${bucketName}`);

    const { serveUrl, siteName } = await deploySite({
        bucketName,
        entryPoint: path.resolve(process.cwd(), 'remotion/index.ts'),
        region: region as any,
        siteName: 'typography-site-v13', // Incrementing version
    });

    console.log(`Deployed site to: ${serveUrl}`);
    console.log(`Site name: ${siteName}`);

    console.log(`
  IMPORTANT: 
  You must update 'SERVE_URL' in 'app/api/render-typography/route.ts' 
  to point to: 
  ${serveUrl}
  `);
};

start();
