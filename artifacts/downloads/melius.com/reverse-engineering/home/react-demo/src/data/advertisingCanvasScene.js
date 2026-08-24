export const advertisingCanvasScene = {
  width: 1100,
  media: [
    { id: "node-1", x: 64, y: 150, maxWidth: 300, tag: "Image", title: "Product Mockup", model: "GPT Image 2", media: { type: "image", image: { src: "95caea352ed126fa508d.webp", width: 753, height: 492, alt: "Advertising: Product Mockup" } } },
    { id: "node-2-image", x: 460, y: 266, maxWidth: 220, tag: "Image", title: "Studio Shot", model: "Nano Banana Pro", media: { type: "image", image: { src: "88872a5492cfd32bb64e.webp", width: 753, height: 738, alt: "Advertising: Studio Shot" } } },
    { id: "node-2-video", x: 760, y: 15, maxWidth: 270, tag: "Video", title: "Lifestyle Moment", model: "Seedance 2.0", media: { type: "video", video: { src: "0b35cf63739d10344eb0.webm", width: 834, height: 1112, label: "Advertising: Lifestyle Moment" } } },
  ],
  connections: [
    { from: "node-1", to: "node-2-image" },
    { from: "node-1", to: "node-2-video" },
  ],
};
