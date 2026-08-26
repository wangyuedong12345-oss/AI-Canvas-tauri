import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AssetThumb from '../../src/components/shared/AssetThumb';

describe('AssetThumb', () => {
  it('renders video assets as playable video elements', () => {
    const html = renderToStaticMarkup(
      <AssetThumb assetUrl="asset://project/video.mp4" name="生成视频.mp4" category="video" size={1024} />,
    );

    expect(html).toContain('<video');
    expect(html).toContain('src="asset://project/video.mp4"');
    expect(html).toContain('controls');
    expect(html).not.toContain('<img');
  });

  it('keeps image assets as lazy image elements', () => {
    const html = renderToStaticMarkup(
      <AssetThumb assetUrl="asset://project/image.png" name="生成图片.png" category="image" size={1024} />,
    );

    expect(html).toContain('<img');
    expect(html).toContain('src="asset://project/image.png"');
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('<video');
  });
});
