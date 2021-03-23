import {SvgPlus, SvgPath} from 'https://www.svg.plus/3.5.js'
import {HeartFrames} from './data.js'
import { AudioContext, OfflineAudioContext } from 'https://jspm.dev/standardized-audio-context';

class Heart extends SvgPlus{
  constructor(){
    super('svg');

    this._bpm = 160/2;
    this.frames = HeartFrames;
    this.g = this.createChild('g');
    this.draw(this.frames[0]);
    this.text = this.createChild('text');
    this.text.styles = {
      // fill: 'white',
      stroke: 'none'
    }
    this.viewBoxSizer();
    this.text.innerHTML = "hello"

    this.bass_specs = [30, 140];
    this.snare_specs = [1750, 3000];

    this.bass_thld = 20;

    this.last_bass = 0;
    this.last_bass_dir = 0;

    this.sizeX = 50;
    this.sizeV = 0;
    this.sizeA = 0.8;
    this.size();

    this.ema = 0;
    this.smoothing = 2;
    this.smpls = 30;


  }

  async extract(file){
    return new Promise((resolve, reject) => {
      let object = new SvgPlus('object');
      object.props = {
        type:"image/svg+xml" ,
        data: file
      }
      document.body.appendChild(object);
      object.onload = () => {
        resolve(object.contentDocument.documentElement);
        object.remove();
      }
    })
  }

  async parse(){
    let data = []
    for (var i = 1; i < 26; i++){
      let svg = await this.extract(`./svgFrames/heart_f${i}.svg`);
      let json = {};
      for (var child of svg.children) {
        var d = child.getAttribute('d');

        if ( d !== null ) {

          var id = child.id;
          var type = id.split('_')[0];
          json[type] = d;
        }
      }
      data.push(json);

    }
    this.frames = data;
  }

  set bpm(bpm){
    this._bpm = bpm;
  }
  get bpm(){
    return this._bpm;
  }

  get mspb(){
    return 60 * 1000 / this.bpm;
  }

  get fr(){
    return this.mspb / this.frames.length;
  }

  playSong(){
    if (this.playing) return;
    var audio = new Audio('Holy.mp3');
    this.playing = true;
    this.handleStream(audio);
    audio.play();
  }

  draw(frame){
    this.g.innerHTML = ""
    for (var pathName in frame) {
        let path = new SvgPath();
        this.g.appendChild(path)
        path.d_string = frame[pathName];
    }
  }

  viewBoxSizer(){
    let h = window.innerHeight;
    let w = window.innerWidth;
    let viewBox;
    if (h > w) {
      h = h * 600 / w;
      viewBox = `-75 -${(h - 600)/2} 600 ${h}`;
    }else{
      w = w * 600 / h;
      console.log(w);
      viewBox = `-${(w - 600)/2} -50 ${w} 600`;
    }
    this.props = {
      viewBox: viewBox
    }
  }

  printError(error){
    this.text.innerHTML = Math.round((error) * 1000)/1000;
  }

  getBass(){
    if (!this.playing) return;
    // this.printError(std);
    let n = this.bass_analyser.fftSize;
    var buffer = new Float32Array(n);
    this.bass_analyser.getFloatTimeDomainData(buffer);

    let std = 0;
    for (var i = 0; i < n; i++){
      std += (buffer[i] * buffer[i])
    }
    std = Math.sqrt(std)/n;
    std *= 10000

    this.ema = std*(this.smoothing/(1 + this.smpls)) + this.ema * (1 - this.smoothing/(1 + this.smpls))

    this.printError(std - this.ema);

    let dir = std > this.last_bass;
    let delta = std - this.ema;
    this.last_bass = std;
    // if (!dir && this.last_bass_dir){
      if (delta > this.bass_thld/2){
        this.sizeV = std/9;
      }
    // }else{
      // this._runVSceneMethod('onBass', std)
    // }
    this.last_bass_dir = dir;
  }

  handleStream(stream){
    this.ctx = new AudioContext();
    this.src = this.ctx.createMediaElementSource(stream);
    var gainNode = this.ctx.createGain();
    // gainNode.gain.value = 10;


    this.bass_freq = this.ctx.createBiquadFilter()
    this.snare_freq = this.ctx.createBiquadFilter()
    this.bass_freq.type = 'bandpass';
    this.snare_freq.type = 'bandpass';

    let freq_center = (this.bass_specs[0] + this.bass_specs[1])/2;
    this.bass_freq.frequency.value = freq_center;
    this.bass_freq.Q.value = freq_center/(this.bass_specs[1] - this.bass_specs[0]);

    this.bass_analyser = this.ctx.createAnalyser();

    this.src.connect(this.bass_freq);

    this.bass_freq.connect(this.bass_analyser);

    this.src.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    let next = () => {
      this.getBass();
      this.size();
      window.requestAnimationFrame(next);
    }
    window.requestAnimationFrame(next);
  }

  size(){
    this.sizeX += this.sizeV;
    this.sizeV -= this.sizeA;
    if (this.sizeX < 50){
      this.sizeX = 50;
      this.sizeV = 0;
    }

    this.g.styles = {
       'transform-origin': '60vw 50vh',
       transform: `scale(${this.sizeX/100})`,
    }
    this.g.props = {
      // 'transform-origin': 'center'
    }

  }

  start(){
    var i = 0;
    var sum = 0;
    var runerror = 0;
    var error = 0;
    var lastb = 0;
    let next = (t) => {
      let dt = t - lastt;
      lastt = t;
      if (i == 0 && error > 0){
        error -= dt;
      }else{
        if (i == 0){

          runerror += this.mspb - (t - lastb);
          lastb = t;
          if (runerror < -this.mspb){
            runerror= 0;
          }
        }
        sum +=dt;
        this.draw(this.frames[i]);

        i = (i + 1) % this.frames.length;
        if (i == 0) {
          error += this.mspb - sum;
          sum = 0;
        }
      }
      window.requestAnimationFrame(next);

    }

    var lastt = window.performance.now();
    window.requestAnimationFrame(next);
  }


}

export {Heart}
