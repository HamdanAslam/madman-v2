import { Player } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';

export async function initPlayer(client) {
  const player = new Player(client, {
    ytdlOptions: {
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
    },
  });

  await player.extractors.loadMulti(DefaultExtractors);

  client.player = player;
}
