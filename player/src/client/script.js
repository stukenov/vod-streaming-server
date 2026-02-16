import 'hls-video-element';
import 'player.style/yt';

// Initialize player when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const player = document.querySelector('hls-video');
  
  if (player) {
    // Add any custom player initialization here
    player.addEventListener('play', () => {
      console.log('Video started playing');
    });

    player.addEventListener('pause', () => {
      console.log('Video paused');
    });

    player.addEventListener('ended', () => {
      console.log('Video ended');
    });
  }
}); 