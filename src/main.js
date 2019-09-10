(() => {
  (function(global){
    module = window.noise = {};

    function G(x, y, z) {
      this.x = x; this.y = y; this.z = z;
    }
    
    G.prototype.dot2 = function(x, y) {
      return this.x*x + this.y*y;
    };

    G.prototype.dot3 = function(x, y, z) {
      return this.x*x + this.y*y + this.z*z;
    };

    g3 = [new G(1,1,0),new G(-1,1,0),new G(1,-1,0),new G(-1,-1,0),
                new G(1,0,1),new G(-1,0,1),new G(1,0,-1),new G(-1,0,-1),
                new G(0,1,1),new G(0,-1,1),new G(0,1,-1),new G(0,-1,-1)];

    var p = [];
    while (p.length<300) {
      p.push(rint(0,255));
    }
    p = [...new Set(p)];
    // To remove the need for index wrapping, double the permutation table length
    perm = new Array(512);
    gP = new Array(512);

    // This isn't a very good seeding function, but it works ok. It supports 2^16
    // different seed values. Write something better if you need more seeds.
    module.seed = function(seed) {
      if(seed > 0 && seed < 1) {
        // Scale the seed out
        seed *= 65536;
      }

      seed = Math.floor(seed);
      if(seed < 256) {
        seed |= seed << 8;
      }

      for( i = 0; i < 256; i++) {
        v=0;
        if (i & 1) {
          v = p[i] ^ (seed & 255);
        } else {
          v = p[i] ^ ((seed>>8) & 255);
        }

        perm[i] = perm[i + 256] = v;
        gP[i] = gP[i + 256] = g3[v % 12];
      }
    };

    module.seed(0);

    /*
    for( i=0; i<256; i++) {
      perm[i] = perm[i + 256] = player[i];
      gP[i] = gP[i + 256] = g3[perm[i] % 12];
    }*/

    // Skewing and unskewing factors for 2, 3, and 4 dimensions
    F2 = 0.5*(Math.sqrt(3)-1);
    G2 = (3-Math.sqrt(3))/6;

    // 2D simplex noise
    module.simplex2 = function(xin, yin) {
      n0, n1, n2; // Noise contributions from the three corners
      // Skew the input space to determine which simplex cell we're in
      s = (xin+yin)*F2; // Hairy factor for 2D
      i = Math.floor(xin+s);
      j = Math.floor(yin+s);
      t = (i+j)*G2;
      x0 = xin-i+t; // The x,y distances from the cell origin, unskewed.
      y0 = yin-j+t;
      // For the 2D case, the simplex shape is an equilateral triangle.
      // Determine which simplex we are in.
      i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
      if(x0>y0) { // lower triangle, XY order: (0,0)->(1,0)->(1,1)
        i1=1; j1=0;
      } else {    // upper triangle, YX order: (0,0)->(0,1)->(1,1)
        i1=0; j1=1;
      }
      // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
      // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
      // c = (3-sqrt(3))/6
      x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
      y1 = y0 - j1 + G2;
      x2 = x0 - 1 + 2 * G2; // Offsets for last corner in (x,y) unskewed coords
      y2 = y0 - 1 + 2 * G2;
      // Work out the hashed gradient indices of the three simplex corners
      i &= 255;
      j &= 255;
      gi0 = gP[i+perm[j]];
      gi1 = gP[i+i1+perm[j+j1]];
      gi2 = gP[i+1+perm[j+1]];
      // Calculate the contribution from the three corners
      t0 = 0.5 - x0*x0-y0*y0;
      if(t0<0) {
        n0 = 0;
      } else {
        t0 *= t0;
        n0 = t0 * t0 * gi0.dot2(x0, y0);  // (x,y) of g3 used for 2D gradient
      }
      t1 = 0.5 - x1*x1-y1*y1;
      if(t1<0) {
        n1 = 0;
      } else {
        t1 *= t1;
        n1 = t1 * t1 * gi1.dot2(x1, y1);
      }
      t2 = 0.5 - x2*x2-y2*y2;
      if(t2<0) {
        n2 = 0;
      } else {
        t2 *= t2;
        n2 = t2 * t2 * gi2.dot2(x2, y2);
      }
      // Add contributions from each corner to get the final noise value.
      // The result is scaled to return values in the interval [-1,1].
      return 70 * (n0 + n1 + n2);
    };

    // ##### Perlin noise stuff

    function fade(t) {
      return t*t*t*(t*(t*6-15)+10);
    }

    function lerp(a, bs, t) {
      return (1-t)*a + t*bs;
    }

    // 2D Perlin Noise
    module.perlin2 = function(x, y) {
      // Find unit grid cell containing point
      X = Math.floor(x), Y = Math.floor(y);
      // Get relative xy coordinates of point within that cell
      x = x - X; y = y - Y;
      // Wrap the integer cells at 255 (smaller integer period can be introduced here)
      X = X & 255; Y = Y & 255;

      // Calculate noise contributions from each of the four corners
      n00 = gP[X+perm[Y]].dot2(x, y);
      n01 = gP[X+perm[Y+1]].dot2(x, y-1);
      n10 = gP[X+1+perm[Y]].dot2(x-1, y);
      n11 = gP[X+1+perm[Y+1]].dot2(x-1, y-1);

      // Compute the fade curve value for x
      u = fade(x);

      // Interpolate the four results
      return lerp(
          lerp(n00, n10, u),
          lerp(n01, n11, u),
        fade(y));
    };

  })(this);

  (function() {

    Camera = function(context, settings) {
      settings = settings || {};
      var t = this;
      t.d = 1000.0;
      t.la = [0,0];
      t.context = context;
      t.fieldOfView = settings.fieldOfView || Math.PI / 4.0;
      t.vp = {
        lf: 0,
        rt: 0,
        tp: 0,
        bottom: 0,
        w: 0,
        h: 0,
        scale: [1.0, 1.0]
      };
      t.updatevp();
    };

    Camera.prototype = {
      begin: function() {
        var t = this;
        t.context.save();
        t.applyScale();
        t.applyTranslation();
      },
      end: function() {
        this.context.restore();
      },
      applyScale: function() {
        this.context.scale(this.vp.scale[0], this.vp.scale[1]);
      },
      applyTranslation: function() {
        this.context.translate(-this.vp.lf, -this.vp.tp);
      },
      updatevp: function() {
        var t = this;
        t.aspectRatio = t.context.canvas.width / t.context.canvas.height;
        t.vp.w = t.d * Math.tan(t.fieldOfView);
        t.vp.h = t.vp.w / t.aspectRatio;
        t.vp.lf = t.la[0] - (t.vp.w / 2.0);
        t.vp.tp = t.la[1] - (t.vp.h / 2.0);
        t.vp.rt = t.vp.lf + t.vp.w;
        t.vp.bottom = t.vp.tp + t.vp.h;
        t.vp.scale[0] = t.context.canvas.width / t.vp.w;
        t.vp.scale[1] = t.context.canvas.height / t.vp.h;
      },
      zoomTo: function(z) {
        this.d = z;
        this.updatevp();
      },
      moveTo: function(x, y) {
        this.la[0] = x;
        this.la[1] = y;
        this.updatevp();
      },
      screenToWorld: function(x, y, obj) {
        obj = obj || {};
        obj.x = (x / this.vp.scale[0]) + this.vp.lf;
        obj.y = (y / this.vp.scale[1]) + this.vp.tp;
        return obj;
      },
      worldToScreen: function(x, y, obj) {
        obj = obj || {};
        obj.x = (x - this.vp.lf) * (this.vp.scale[0]);
        obj.y = (y - this.vp.tp) * (this.vp.scale[1]);
        return obj;      
      }
    };

    this.Camera = Camera;
    
  }).call(this);

  var w=a.width;
  var h=a.height;
  var mapw=40*2;
  var maph=(32 * 3)+6;
  var ctx=a.getContext('2d', { alpha: !1 });
  ctx.imageSmoothingEnabled=false;
  ctx.mozImageSmoothingEnabled=false;
  ctx.msImageSmoothingEnabled=false;
  var camera=new Camera(ctx);
  camera.vp.w = w;
  camera.vp.h = h;
  var players = [];
  var gravity=0.2;
  var screen=1;
  var k=[];//inpt
  var bgTiles = a2(mapw, maph, null);
  var tiles=a2(mapw, maph, null);
  var alwaysLoadedTiles = a2(mapw, maph, null);//always loaded
  var fgTiles = a2(mapw, maph, null);
  var tileSize=32;//tile size
  var bgTileSize=32;//bg tile size
  var bgParallax = 0.25;
  var spaceship = null;
  var hasLaunched = false;
  var clouds=[];
  var mobs=[];
  var parts=[];
  var projs=[];
  var spawnDelay=300;
  var spawnTick=0;
  var spawnCloudDelay = 60;
  var spawnCloudTick = 0;
  var n=noise;
  var mseed=rint(0,6000);
  var seeds=[];
  for (var i=0;i<10;i++) {
    seeds.push(rint(0,6000));
  }
  noise.seed(mseed);

  var ir='images/';

  var grass=lc('grass','.gif');
  var dirt=lc('dirt','.gif');
  var rock=[];
  for (var i = 0; i < 3; i++) {
    rock.push(lc('rock'+i,'.gif'));
  }
  var rockblue=lc('rockblue','.gif');
  var oiron=lc('oiron','.gif');
  var lavarock=lc('lavarock','.gif');
  var bedrock=lc('bedrock','.gif');
  var ladder=lc('ladder','.png');
  var lava=lc('lava','.gif');
  var ecrystal=lc('ecrystal','.png');
  var bg_rocks=[];
  for (var i = 0; i < 3; i++) {
    bg_rocks.push(lc('bg_rock'+i,'.gif'));
  }
  var bg_lavarock=lc('bg_lavarock','.gif');
  var bg_stars=lc('bg_stars','.gif');
  var spcship=lc('spcship','.png');
  var player=lc('player','.png');
  var player_drilling=lc('playerdown','.png');
  var plasmaball=lc('plasmaball','.png');
  var oortbug=lc('oortbug','.png');
  var heart=lc('heart','.png');
  var heartempty=lc('heartempty','.png');
  var lifecanister=lc('lifecanister','.gif');
  var cloud_imgs=[];
  for (var i = 0; i < 1; i++) {
    cloud_imgs.push(lc('cloud'+i,'.png'));
  }

  var worldTemplates = [
    {
      name: "grass",
      rockIndex: 0,
      hasGrass: true,
      hasDirt: true,
      hasSky: true
    },
    {
      name: "blue",
      rockIndex: 1,
      hasGrass: !rint(0, 1),
      hasDirt: !rint(0, 1),
      hasSky: !rint(0, 1)
    },
    {
      name: "sand",
      rockIndex: 2,
      hasGrass: !1,
      hasDirt: !1,
      hasSky: !rint(0, 1)
    }
  ];
  worldTemplate = worldTemplates[rint(0, worldTemplates.length - 1)];  
  function getRandomHex() {
    var chars = [1,2,3,4,5,6,7,8,9,"A","B","C","D","E","F"];
    var code = "#";
    for (var i = 0; i < 6; i++) {
      code += chars[rint(0, chars.length - 1)];
    }
    return code;
  }
  worldTemplate.skyColor = getRandomHex();

  function distance(x1, y1, x2, y2){
    var a = x1 - x2;
    var b = y1 - y2;
    
    return Math.hypot(a, b);
  }

  function clamp(val, min, max) {
    if (val < min) return min;
    if (val > max) return max;
    return val;
  }

  function rint(min, max) {
      min = Math.ceil(min);
      max = Math.floor(max);
      return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function tileWithinMap(x, y) {
    if (x >= 0 && x < mapw &&
        y >= 0 && y < maph) {
      
      return true;
    }
    return false;
  }

  function colCheck(shapeA, shapeB) {
    
    // get the vectors to check against
    vX = (shapeA.x + (shapeA.w / 2)) - (shapeB.x + (shapeB.w / 2)),
        vY = (shapeA.y + (shapeA.h / 2)) - (shapeB.y + (shapeB.h / 2)),
        // add the half widths and half heights of the objects
        hWidths = (shapeA.w / 2) + (shapeB.w / 2),
        hHeights = (shapeA.h / 2) + (shapeB.h / 2),
        cold = null;
    // if the x and y vector are less than the half w or half h, they we must be inside the object, causing a collision
    if (Math.abs(vX) < hWidths && Math.abs(vY) < hHeights) {
        // figures out on which side we are colliding (tp, bottom, lf, or rt)
        oX = hWidths - Math.abs(vX),
            oY = hHeights - Math.abs(vY);
        if (oX >= oY) {
            if (vY > 0) {
              if (shapeA.vy < 10) {
                  cold = "t";
                  shapeA.y += oY;
              }
              else {
                if (vX > 0) {
                  cold = "l";
                  shapeA.x += oX;
                } else {
                  cold = "r";
                  shapeA.x -= oX;
                }
              }
            } else {
                cold = "bs";
                shapeA.y -= oY;
            }
        } else {
            if (vX > 0) {
                cold = "l";
                shapeA.x += oX;
            } else {
                cold = "r";
                shapeA.x -= oX;
            }
        }
    }
    return cold;
  }

  function colRect(rect1, rect2) {
    if (rect1.x < rect2.x + rect2.w &&
      rect1.x + rect1.w > rect2.x &&
      rect1.y < rect2.y + rect2.h &&
      rect1.y + rect1.h > rect2.y) {
       // collision detected!
       return true;
    }
    return false;
  }

  function sgf(value, cellSize) {
    return Math.floor(value / cellSize) * cellSize;
  }

  function b(n) {
    if(n){n=true}else{n=false}
    n=n?true:false;
    n=n?!0:!1;
    n=!!n;
    return n;
  }

  // 1D Perlin
  var slopeAt = [];
  for (let i = 0; i < 10; i++) {
    slopeAt[i] = rint(0,100)-1;
  }

  function sap(x) {
    var lo = Math.floor(x);
    var hi = lo+1;
    var dist = x-lo;
    loSlope = slopeAt[lo];
    hiSlope = slopeAt[hi];
    loPos = loSlope * dist;
    hiPos = -hiSlope * (1-dist);
    var u = dist * dist * (3.0 - 2.0 * dist);  // cubic curve
    return (loPos*(1-u)) + (hiPos*u);  // interpolate
  }

  class Anim {
    constructor(amtF,f,d) {
      var t = this;
      t.amtF=amtF;
      t.f=f;
      t.t=0;
      t.d=d;
      t.on=!0;
    }
    update(){
      var t = this;
      if (t.on) {
        if(t.t<t.d){
          t.t++;
        }
        else {
          if(t.f<t.amtF-1){
            t.f++;
          }
          else{
            t.f=0;
          }
          t.t=0;
        }
      }
    }
  }

  class Tile{
    constructor(x,y,i,args){
      args=args||{
        canFlip:true,
        destructible:true,
        collidable:true,
        damage: null
      };
      var t = this;
      t.x=x;
      t.y=y;
      t.i=i;
      t.w=tileSize;
      t.h=tileSize;
      t.vx = 0;
      t.vy = 0;
      t.hf=0; // horizontal flip
      t.vf=0; // vertical flip
      t.collidable=args.collidable;
      t.destructible=args.destructible;
      t.damage=args.damage;
      if (args.canFlip) {
        t.hf=rint(0,1);
        t.vf=rint(0,1);
      }
      t.iVis=!0;//img visible
      t.rVis=!1;//rect visible
      t.rCol='#000';
      t.dmg = 0;
    }
    hit(amt) {
      if (this.dmg < 1 && this.destructible) {
        this.dmg += amt;

        if (rint(0, 100) > 80) {
          var part = new Part(
            rint(this.x - 2, this.x + this.w + 2),
            rint(this.y - 2, this.y + this.h + 2),
            4,
            4,
            this.i
          );
          parts.push(part);
        }
      }
    }
    update() {
      var t = this;

      t.x += t.vx;
      t.y += t.vy;
    }
    draw(ctx){
      var t = this;
      if (t.iVis && !t.rVis) {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.scale(!t.hf?1:-1, !t.vf?1:-1);
        ctx.drawImage(t.i, -Math.sign(t.hf)*t.w, -Math.sign(t.vf)*t.h, t.w, t.h);
        ctx.restore();
      }
      //drawImage(this.i,this.x,this.y, 1, this.r);

      if (t.rVis && !t.isVis) {
        ctx.save();
        ctx.fillStyle = t.rCol;
        ctx.fillRect(t.x,t.y,t.w,t.h);
        ctx.strokeStyle=t.rCol;
        ctx.strokeRect(t.x,t.y,t.w,t.h);
        ctx.restore();
      }

      if (t.dmg > 0) {
        ctx.save();
        ctx.fillStyle = t.rCol;
        ctx.globalAlpha = t.dmg * 0.65;
        ctx.fillRect(t.x,t.y,t.w,t.h);
        ctx.strokeStyle = t.rCol;
        ctx.strokeRect(t.x,t.y,t.w,t.h);
        ctx.restore();
      }
    }
  }

  class BgTile extends Tile {
    constructor(x, y, is, i) {
      super(x, y, is[i]);
      this.is = is;
    }
  }

  class FgTile extends Tile {
    constructor(x, y, i) {
      super(x, y, i);
    }
  }

  class E {
    constructor(x,y) {
      var t = this;
      t.x=x;
      t.y=y;
      t.ax = 0;
      t.ay = 0;
      t.vx = 0;
      t.vy = 0;
      t.hp=1;
    }

    getTile(arr) {

      var tile = null;

      var x = sgf(this.x, tileSize) / tileSize;
      var y = sgf(this.y, tileSize) / tileSize;
    
      if (tileWithinMap(x, y)) {
        tile = arr[x][y];
      }

      return tile;
    }

    getTilePos() {

      var x = sgf(this.x, tileSize) / tileSize;
      var y = sgf(this.y, tileSize) / tileSize;

      return {x:x,y:y};
    }
  }

  class Cloud extends E {
    constructor(x,y,w,h,i) {
      super(x, y);
      var t = this;
      t.i = i;
      t.w = w;
      t.h = h;
      t.vx = -rint(0.1, 2);
      t.canDestroy = !1;
    }

    update() {
      var t = this;
      t.x += t.vx;
      t.y += t.vy;
    }

    draw(ctx) {
      var t = this;
      ctx.drawImage(t.i, t.x, t.y, t.w, t.h);
    }
  }

  class Part extends E {
    constructor(x,y,w,h,i,col) {
      super(x, y);
      var t=this;
      t.i=i;
      t.col = col;
      t.w=w;
      t.h=h;
      t.delay = 90;
      t.tick = 0;
      t.gnd=!1;
      t.canDestroy = !1;
    }

    owc(d) {
    }

    update() {
      var t=this;

      if (t.tick < t.delay) {
        t.tick++;
      }
      else {
        t.canDestroy = true;
      }

      if (t.gnd) {
        t.vy = 0;
      }

      if (t.vy < 10) {
        t.vy += gravity;
      }

      t.x += t.vx;
      t.y += t.vy;
    }

    draw(ctx) {
      var t = this;

      if (t.col) {
        ctx.save();
        ctx.fillStyle = t.col;
        ctx.fillRect(t.x, t.y, t.w, t.h);
        ctx.restore();
      }
      else {
        ctx.drawImage(t.i, t.x, t.y, t.w, t.h);
      }
    }
  }

  class P extends E {
    constructor(x,y,i) {
      super(x, y);
      var t=this;
      t.i=i;
      t.w=10;
      t.h=14;
      t.spd=1;
      t.vx=0;
      t.vy=0;
      t.fric = 0.8;
      t.jmp=!1;
      t.gnd=!1;
      t.dsh=!1;
      t.drlg=!1;
      t.fc = "R";
      t.vxm=1; // velocity multiplier
      t.sd=99999;
      t.st=0;
      t.ecrystal=0;
      t.ammo=0;
      t.iron=0;
      t.maxhp=3;
      t.hp=3;
      t.dead=false;
      t.invinc=!1;
      t.invincTick=0;
      t.invincDelay=120;
      t.visible=true;
      t.cheatmode=!1;
      t.anim=new Anim(2,0,8);
    }

    damage(amt) {

      if (!this.invinc && !hasLaunched) {
        if (this.hp - amt > 0) {
          this.hp -= amt;
        }
        else {
          this.hp = 0;
          this.dead = true;
        }

        this.invincTick = 0;
        this.invinc = true;
      }

    }

    update() {
      var t=this;
      
      if (!t.cheatmode) {

        if (t.gnd) {
          t.vy = 0;
        }

        if (t.dsh) {
          t.vxm=2;
          t.anim.d=4;
        }
        else {
          t.vxm=1;
          t.anim.d=8;
        }

        t.vx *= t.fric;
        if (t.vy < 10) {
          t.vy += gravity;
        }

        if (Math.abs(t.vx) < 0.1 ) {
          t.anim.on=!1;
        }
        else if (t.vx >= 0.5 || t.vx <= -0.5) {
          t.anim.on=!0;
        }
      }
      else {
        t.vx *= t.fric;
        t.vy *= t.fric;
      }

      if (hasLaunched) {
        t.vx = 0;
        t.vy = 0;
      }

      t.x += t.vx;
      t.y += t.vy;

      t.anim.update();

      if (t.invinc) {
        if (t.invincTick < t.invincDelay) {
          t.invincTick++;

          t.visible=!t.visible;
        }
        else {
          t.invinc = false;
          t.visible = true;

          t.invincTick = 0;
        }
      }

      if (t.dead) {
        t.visible = false;
      }

      /*
      if (t.x >= w-t.i.w) {
        t.x = w-t.i.w;
      }
      else if (this.x <= 0) {
        this.x = 0;
      }

      if (this.y >= h-this.i.h) {
        this.y = h-this.i.h;
        this.jmp = !1;
      }*/

    }

    draw(ctx) {
      //drawImage(this.i,this.x,this.y,1,this.r);
      ctx.save();

      var overrideDraw = !1;

      if (this.drlg) {
        overrideDraw = !0;
      }

      if (!overrideDraw && this.visible) {
        if (this.fc == 'L') {

          ctx.translate(this.x, this.y);
          ctx.scale(-1, 1);
          ctx.drawImage(this.i, this.anim.f*10,0,10,16,-10, 0,10,16);
        }
        else if (this.fc == 'R') {
          ctx.drawImage(this.i, this.anim.f*10,0,10,16,this.x, this.y, 10, 16);
        }
      }
      else {
        if (this.drlg && this.idrlg !== undefined && !hasLaunched) {
          ctx.drawImage(this.idrlg, this.x, this.y);
        }
      }

      ctx.restore();
    }
  }

  class Proj extends E {
    constructor(x,y,i,vx,vy,friendly) {
      super(x,y);
      var t = this;
      t.i=i;
      t.w=i.w;
      t.h=i.h;
      t.vx=vx;
      t.vy=vy;
      t.friendly=friendly;
    }

    update(){
      var t = this;

      t.x += t.vx;
      t.y += t.vy;
    }

    draw(ctx){
      var t = this;
      ctx.drawImage(t.i, t.x, t.y);
    }
  }

  class Spaceship extends E {
    constructor(x, y, w, h, i) {
      super(x, y);
      var t = this;
      t.w = w;
      t.h = h;
      t.i = i;
    }

    update() {
      var t = this;
      t.vx += t.ax;
      t.vy += t.ay;

      t.x += t.vx;
      t.y += t.vy;
    }

    draw(ctx) {
      var t = this;
       ctx.drawImage(t.i, t.x, t.y, t.w, t.h);
    }
  }

  class GroundMob extends E {
    constructor(x,y,w,h,i,isAnim, mf, fd=30) {
      super(x,y);
      var t = this;
      t.i=i;
      t.w=w;
      t.h=h;
      t.isAnim=isAnim;
      t.frame=0;
      t.mf=mf;
      t.fd=fd;
      t.ft=0;
      t.fc="R";
      t.gnd=!1;
      t.jmp=!1;
      t.vx=0;
      t.vy=0;
      t.fr=0;
    }

    baseupdate(){
      var t = this;

      if (t.gnd) {
        t.vy = 0;
      }

      if (t.vy < 10) {
        t.vy += gravity;
      }

      t.x += t.vx;
      t.y += t.vy;


      if (t.ft < t.fd) {
        t.ft++;
      }
      else {
        if (t.frame < t.mf - 1) {
          t.frame++;
        }
        else {
          t.frame = 0;
        }

        t.ft=0;
      }

    }

    draw(ctx) {
      var t = this;

      ctx.save();

      if (b(t.fr)) {
        ctx.filter = t.fr;
      }

      if (t.fc == 'L') {

        ctx.translate(t.x, t.y);
        ctx.scale(-1, 1);
        if (t.isAnim) {
          ctx.drawImage(t.i, t.frame * t.w, 0, t.w, t.h, -16, 0, t.w, t.h);
        }
        else {
          ctx.drawImage(t.i, -10, 0, t.w, t.h);
        }
      }
      else if (t.fc == 'R') {
        if (t.isAnim) {
          ctx.drawImage(t.i, t.frame * t.w, 0, t.w, t.h, t.x, t.y, t.w, t.h);
        }
        else {
          ctx.drawImage(t.i, t.x, t.y, t.w, t.h);
        }
      }
      ctx.restore();
    }
  }

  class OortBug extends GroundMob {
    constructor(x,y,i) {
      super(x,y,16,12,i,!0,2,4);
      this.vx = rint(0,10) > 1 ? -1 : 1;
      if (Math.sign(this.vx) == 1) {
        this.fc = "R";
      }
      else {
        this.fc = "L";
      }
      this.fr=rint(0,1)?'hue-rotate('+rint(0,360)+'deg)':0;
    }

    update() {
      this.baseupdate();
    }

    owc(d) {
      var t = this;

      t.vx = -t.vx;

      t.vy = -4;
      t.jmp = !0;
      t.gnd = !1;

      if (d == 'l') {
        t.fc = 'R';
      }
      else {
        t.fc = 'L';
      }
    }
  }

  function a2(numrows, numcols, initial)
  {
    arr = [];
    for ( i = 0; i < numrows; ++i)
    {
      columns = [];
      for ( j = 0; j < numcols; ++j)
      {
        columns[j] = initial;
      }
      arr[i] = columns;
    }
    return arr;
  }

  function lc(fn,ext,amt=0) {
    c=0;
    if (amt>0) {
      c=[];
      for( i=0;i<amt;i++){
        im=new Image();
        im.src=ir+fn+i+ext;
        c.push(im);
      }
      return c;
    }
    else {
      c=new Image();
      c.src=ir+fn+ext;
    }
    return c;
  }

  function init(){

    switch(screen) {
      case 0: {
        
        break;
      }
      case 1: {

        for(xp=0;xp<bgTiles.length;xp++) {
          var prln=Math.floor(sap(xp/100) + 32);

          for(yp=prln;yp>0;yp--){

            canAdd=!0;

            var skyTexture = bg_stars;
            
            if (canAdd && !worldTemplate.hasSky) {
              //tile=new BgTile(xp*bgTileSize,yp*bgTileSize,[skyTexture],0);

              //bgTiles[xp][yp] = tile;
            }
          }

          for(yp=prln;yp<maph;yp++){

            canAdd=!0;

            texture = bg_rocks[worldTemplate.rockIndex];

            if (yp > maph-(maph/4)) {
              texture = bg_lavarock;
            }
            
            if (canAdd) {
              tile=new BgTile(xp*bgTileSize,yp*bgTileSize,[texture],0);
              bgTiles[xp][yp] = tile;
            }

          }
        }

        for ( xp=0;xp<mapw;xp++) {
          var prln=Math.floor(sap(xp/100) + 32);

          for ( yp=prln;yp<maph+6;yp++) {

            canAdd=!0;
            d=10;
            d2=20;
            d3=20;
            texture = rock[worldTemplate.rockIndex];
            args = {
              canFlip:true,
              destructible:true,
              collidable:true,
              damage:null
            };

            if (yp < prln + 6) {
              texture = dirt;

              if (yp == prln) {
                texture = grass;
                args.canFlip = false;
              }
            }

            if (yp > maph-(maph/4)) {
              texture = lavarock;
            }

            noise.seed(seeds[0]);
            p2 = noise.perlin2(xp/d2, yp/d2);

            if (p2 > 0.05 && p2 < 0.2) {
              texture = rockblue;

              if (yp > maph-(maph/4)) {
                texture = lava;
                args.destructible=false;
                args.collidable=false;
                args.damage=3;
              }
            }

            noise.seed(seeds[1]);
            p3 = noise.perlin2(xp/d3, yp/d3);
            if (p3 > 0.025 && p3 < 0.3) {
              texture = oiron;
              args.collidable=true;
              args.destructible=true;
            }

            noise.seed(mseed);

            if (yp > prln+(Math.random()*5)+3 && noise.perlin2(xp/d,yp/d) > 0.1) {
              canAdd = !1;
            }
            
            if (canAdd) {
              tile=new Tile(xp*tileSize,yp*tileSize,texture,args);
              tiles[xp][yp] = tile;
            }

            if (yp > maph - rint(6,8)) {
              tiles[xp][yp] = new Tile(xp*tileSize,yp*tileSize,bedrock,{
                canFlip:!0,
                destructible:false,
                collidable:!0
              });
            }

          }
        }


        var spcshipx = Math.floor(mapw/2);

        player = new P(spcshipx*tileSize,128,player);
        player.idrlg = player_drilling;
        players.push(player);

        var foundTile = false;
        for (var y=0;y<maph;y++) {
          if (tiles[spcshipx][y] != null) {
            if (!foundTile) {
              tiles[spcshipx][y - 1] = new Tile(spcshipx*tileSize,(y-1)*tileSize,spcship,{
                canFlip:false,
                destructible:false,
                collidable:true
              });

              player.x=spcshipx*tileSize;
              player.y=(y-1)*tileSize;

              tiles[spcshipx][y].destructible = false;

              foundTile = true;
            }
          }
        }

        // Place energy crystals
        var chunkSize = 3;
        var chunkSizeInTilesWidth = Math.floor(mapw/chunkSize);
        var chunkSizeInTilesHeight = Math.floor(maph/chunkSize);

        for (cpx=0;cpx<chunkSize;cpx++) {
          for (cpy=1;cpy<chunkSize - 1;cpy++) { 

            var canisterTileLocations = [];
            var crystalTileLocations = [];

            // location in tiles of the current "chunk"
            var left = (cpx*chunkSizeInTilesWidth);
            var top = (cpy*chunkSizeInTilesHeight);

            // Look through the chunk and get locations just above ground
            for (px=left;px<left+chunkSizeInTilesWidth;px++) {
              for(py=top;py<top+chunkSizeInTilesHeight;py++) {

                if (tiles[px][py] !== null) {
                  if (py - 1 >= 0 && py - 1 < maph - 10) {
                    if (tiles[px][py - 1] == null) {
                      
                      canisterTileLocations.push({ x: px, y: py - 1 });
                      crystalTileLocations.push({ x: px, y: py - 1 });
                    }
                  }
                }
              }
            }

            if (crystalTileLocations.length === 0) {
              crystalTileLocations.push({ x: left+rint(0, chunkSizeInTilesWidth), y: chunkSizeInTilesHeight });
            }

            var crystalLocIndex = rint(0,crystalTileLocations.length - 1);
            var loc = crystalTileLocations[crystalLocIndex];
            crystalTileLocations.splice(crystalLocIndex, 1);


            tiles[loc.x][loc.y] = new Tile(loc.x*tileSize,loc.y*tileSize,ecrystal, {
              canFlip: false,
              destructible: true,
              collidable:true
            });


            if (canisterTileLocations.length === 0) {
              canisterTileLocations.push({ x: rint(left,left+chunkSizeInTilesWidth), y: rint(top,top+chunkSizeInTilesHeight) });
            }
            
            if (rint(0, 100) > 75) {
              var canisterLoc = canisterTileLocations[rint(0,canisterTileLocations.length - 1)];
              tiles[canisterLoc.x][canisterLoc.y] = new Tile(canisterLoc.x*tileSize,canisterLoc.y*tileSize,lifecanister, {
                canFlip: false,
                destructible: true,
                collidable:true
              });
            }

          }
        }

        break;
      }
    }
  }
  function update(){

    if (spaceship) {
      spaceship.update();
    }

    if (players.length>0) {

      wcam = { x: camera.vp.lf, y: camera.vp.tp };
      snc = {
        lf: sgf(wcam.x, tileSize)/tileSize,
        tp: sgf(wcam.y, tileSize)/tileSize,
        w: (sgf(camera.vp.w, tileSize)/tileSize)+2,
        h: (sgf(camera.vp.h, tileSize)/tileSize)+2
      };

      var player = players[0];

      if (!player.dead) {
        if (k[90]) { // jump
          if (!player.cheatmode) {
            if (!player.jmp && player.gnd) {
              player.jmp = !0;
              player.gnd = !1;
              player.vy = -4;
            }
          }

          if (player.cheatmode) {
            if (player.vy > -player.spd) {
              player.vy--;
            }
          }
        }

        if (k[40]) { // down
          player.drlg = !0;

          if (player.cheatmode) {
            if (player.vy < player.spd) {
              player.vy++;
            }
          }

        }
        else {
          player.drlg = !1;
        }

        if (k[39]) { // right
          
          if (player.vx < player.spd * player.vxm) {
            player.vx++;
            player.fc = "R";
          }

        }

        if (k[37]) { // left

          if (player.vx > -player.spd * player.vxm) {
            player.vx--;
            player.fc = "L";
          }
        }

        if (k[88]) {

          player.dsh=!0;

          if (player.st < player.sd) {
            player.st++;
          }
          else {
            if (player.ammo>0&&!player.drlg) {
              // player shoot
              var vx=0;
              if (player.fc == "L") {
                vx = -5;
              }
              else {
                vx = 5;
              }
              var proj = new Proj(player.x,player.y+7,plasmaball,vx,0,true);
              projs.push(proj);

              player.ammo--;

              player.st=0;
            }
          }
        }
        else {
          player.dsh=!1;
          player.st=player.sd-1;
        }

        if (k[38]) { // up
          var ftl = player.getTile(fgTiles);
          var tlp = player.getTilePos();

          if (ftl) {
            if (ftl.i == ladder) {
              player.vy=-2;
            }
          }

          var placey=null;
          for (var y = tlp.y; y > 0; y--) {

            if (tileWithinMap(tlp.x, tlp.y)) {
              if (tiles[tlp.x][y] == null && !placey) {
                placey=y;
              }
            }
          }

          if (placey && player.iron>0) {
            if (!fgTiles[tlp.x][placey]) {
              fgTiles[tlp.x][placey] = new FgTile(tlp.x*tileSize,placey*tileSize,ladder,{
                canFlip:!1
              });

              player.iron--;
            }
          }
        }
      }
      else {
        setTimeout(function() {
          document.location.reload(true);
        }, 3000);
      }

      for ( i=0;i<players.length;i++) {
        player.update();
      }


      player.gnd = !1;

      // cloud spawner
      if (spawnCloudTick < spawnCloudDelay) {
        spawnCloudTick++;
      }
      else {
        var cloud = new Cloud(w, rint(0, h), rint(64, 256), rint(32, 64), cloud_imgs[rint(0,cloud_imgs.length-1)]);
        clouds.push(cloud);

        spawnCloudTick = 0;
      }

      // mob spawner
      
      if (spawnTick < spawnDelay) {
        spawnTick++;
      }
      else {
        var locations = [];

        for ( xp = snc.lf; xp < snc.lf + snc.w; xp++) {
          for ( yp = snc.tp; yp < snc.tp + snc.h; yp++) {

            if (tileWithinMap(xp, yp)) {
              var tile = tiles[xp][yp];

              if (tile != null) {
                if (yp - 1 >= 0) {
                  if (tiles[xp][yp - 1] == null) {
                    locations.push({ x: xp, y: yp - 1 });
                  }
                }
              }
            }
          }
        }

        if (mobs.length < 200) {
          var location = locations[rint(0, locations.length - 1)];

          //if (rint(0,100)>98) {
          if (location) {
            if (distance(
              player.x,
              player.y,
              location.x * tileSize,
              location.y * tileSize
            ) > 70) {
              var mob = new OortBug(location.x*tileSize,location.y*tileSize,oortbug);

              mobs.push(mob);
            }
          }
          //}
        }
      
        spawnTick=0;
      }

      clouds = clouds.filter(function(cloud) {
        return !cloud.canDestroy;
      });

      for ( i = 0; i < clouds.length; i++) {
        var cloud = clouds[i];

        if (cloud.x < -cloud.w) {
          cloud.canDestroy = true;
        }

        cloud.vy = -players[0].vy*bgParallax;

        cloud.update();
      }

      parts = parts.filter(function(part) {
        return !part.canDestroy
      });

      for ( i = 0; i < parts.length; i++) {
        var part = parts[i];
        part.update();

        var tp = part.getTilePos();
        for ( xp = tp.x - 3; xp < tp.x + 3; xp++) {
          for ( yp = tp.y - 3; yp < tp.y + 3; yp++) {

            if (tileWithinMap(xp, yp)) {
              t = tiles[xp][yp];

              if (t !== null) {
                if (t.collidable) {
                  d = colCheck(part, t);
            
                  if (d === "bs") {
                    part.gnd = !0;
                  }
                }
              }
            }
          }
        }
      }

      for ( i = 0; i < mobs.length; i++) {
        mob = mobs[i];
        mob.update();

        mob.gnd = !1;

        if (player.x + player.w > mob.x &&
            player.x < mob.x + mob.w &&
            player.y + player.h > mob.y &&
            player.y < mob.y + mob.h) {

        
          if (player.vy >= 0 && player.y + player.h < mob.y + (mob.h/2)){
            player.jmp = !0;
            player.gnd = !1;
            if (player.jmp) {
              player.vy = -player.spd * 4;
            }
            else {
              player.vy = -player.spd * 2;
            }
            
            mobs.splice(i, 1);
          }
          else {
            var d = colRect(player, mob);

            if (d) {
              player.damage(1);
            }
          }

        }

        tp = mob.getTilePos();
        for ( xp = tp.x - 3; xp < tp.x + 3; xp++) {
          for ( yp = tp.y - 3; yp < tp.y + 3; yp++) {

            if (tileWithinMap(xp, yp)) {
              t = tiles[xp][yp];

              if (t !== null) {
                if (t.collidable) {
                  d = colCheck(mob, t);
            
                  if (d === "l" || d === "r") {
                    mob.owc(d);
                    mob.jmp = !1;
                  } else if (d === "bs") {
                    mob.gnd = !0;
                    mob.jmp = !1;
                  }
                }
              }
            }
          }
        }

        for ( j = 0; j < projs.length; j++) {
          var d = colCheck(projs[j], mob);

          if (d) {
            mobs.splice(i, 1);
            projs.splice(j, 1);
          }
        }
      }

      for (i = 0; i < projs.length; i++) {
        projs[i].update();
      }

      for ( xp = 0; xp < mapw; xp++) {
        for ( yp = 0; yp < maph; yp++) {

          var tile = tiles[xp][yp];

          if (tile) {
            if (tile.i == lava) {
              var args = {
                canFlip:true,
                destructible:false,
                collidable:false
              };
              
              if (xp-1 >= 0) {
                if (!tiles[xp-1][yp]) {
                  tiles[xp-1][yp] = new Tile((xp-1)*tileSize,yp*tileSize,lava,args);
                }
              }

              if (xp+1 < mapw) {
                if (!tiles[xp+1][yp]) {
                  tiles[xp+1][yp] = new Tile((xp+1)*tileSize,yp*tileSize,lava,args);
                }
              }

              if (yp+1 < maph) {
                if (!tiles[xp][yp+1]) {
                  tiles[xp][yp+1] = new Tile(xp*tileSize,(yp+1)*tileSize,lava,args);
                }
              }
            }
          }
        }
      }

      for ( xp = snc.lf; xp < snc.lf + snc.w; xp++) {
        for ( yp = snc.tp; yp < snc.tp + snc.h; yp++) {

          if (tileWithinMap(xp, yp)) {
                
            tile = tiles[xp][yp];
              
            if (tile !== null) {

              if (tile.i == spcship) {
                if (player.ecrystal > 0) {
                  if (distance(
                    player.x,
                    player.y,
                    tile.x,
                    tile.y
                  ) < 32) {

                    tile.dmg = 100;

                    spaceship = new Spaceship(xp*tileSize, yp*tileSize, tileSize, tileSize, spcship);
                    spaceship.ay = -0.01;

                    player.visible=false;
                    camera.moveTo(spaceship.x, spaceship.y);
                    hasLaunched = true;
                  }
                }
              }

              if (tile.collidable) {
                d = colCheck(player, tile);

                var dmg = 0.05;

                if (tile.i == rockblue) {
                  dmg = 0.5;
                }

                if (d === "l" || d === "r") {
                  player.vx = 0;
                  player.jmp = !1;
                  player.anim.d=9999;

                  tile.hit(dmg);

                } else if (d === "bs") {
                  player.gnd = !0;
                  player.jmp = !1;

                  if (player.drlg) {
                    tile.hit(dmg);
                  }

                  if (player.vy > 8) {
                    player.damage(Math.round(player.vy * 0.1));
                  }

                } else if (d === "t") {
                  player.vy *= -1;
                }
              }

              if (tile.damage != null) {
                if (colRect(player, tile)) {
                  player.damage(tile.damage);
                }
              }
              
              if (tile.dmg > 0) {
                tile.dmg -= 0.001;
              }
              
              if (tile.dmg >= 1) {

                if (tile.i == rockblue) {
                  player.ammo += 1;
                }
                else if (tile.i == oiron) {
                  var amt = 1;
                  amt = rint(0,100)>80?rint(2,3):amt;
                  player.iron += amt;
                }
                else if (tile.i == lifecanister) {
                  player.maxhp += 1;
                  player.hp = player.maxhp;
                }
                else if (tile.i == ecrystal) {
                  player.ecrystal += 1;
                }

                tiles[xp][yp] = null;
              }
            }
          }
        }
      }

      players[0].x = clamp(players[0].x, 0, (mapw*tileSize)-players[0].w);
      players[0].y = clamp(players[0].y, 0, (maph*tileSize)-players[0].h);

      if (hasLaunched) {
        if (spaceship) {
          camera.moveTo(spaceship.x, spaceship.y);

          var colors = [
            "#ffb012",
            "#ffb012",
            "#ffffff"
          ]
          var color = colors[rint(0, colors.length - 1)];
          var size = rint(2, 16);

          for (var i = 0; i < 4; i++) {
            var part = new Part(
              rint(spaceship.x - 4, spaceship.x + spaceship.w - 8),
              rint(spaceship.y + spaceship.h, spaceship.y + spaceship.h + 32),
              size,
              size,
              null,
              color
            );
            part.delay = 15;
            part.vy = rint(0, 5);
            parts.push(part);
          }
        }
      }
      else {
        ppos= { x: players[0].x, y: players[0].y };
        camera.moveTo(Math.round(ppos.x), Math.round(ppos.y));
      }
      camera.vp.lf = clamp(camera.vp.lf, 0, (mapw*tileSize) - camera.vp.w);
      camera.vp.tp = clamp(camera.vp.tp, 0, (maph*tileSize) - camera.vp.h);

      for ( xp = 0; xp < bgTiles.length; xp++) {

        for( yp=0;yp<bgTiles[xp].length;yp++){

          if (b(bgTiles[xp][yp])) {
            bg=bgTiles[xp][yp];

            if (!hasLaunched) {
              if (camera.vp.lf > 0 && camera.vp.lf < (mapw*tileSize)-camera.vp.w) {
                bg.x += player.vx * bgParallax;
              }
            }
          }
        }
      }
    }
  }
  function draw(ctx){

    ctx.clearRect(0,0,w,h - 4);

    if (worldTemplate.hasSky) {
      ctx.fillStyle = worldTemplate.skyColor;
      ctx.fillRect(0, 0, w, h);
    }

    for ( i = 0; i < clouds.length; i++) {
      var cloud = clouds[i];

      cloud.draw(ctx);
    }

    camera.begin();

    wcam = { x: camera.vp.lf, y: camera.vp.tp, w: camera.vp.w, h: camera.vp.h };
    snc = {
      lf: sgf(wcam.x, tileSize)/tileSize,
      tp: sgf(wcam.y, tileSize)/tileSize,
      w: (sgf(camera.vp.w, tileSize)/tileSize),
      h: (sgf(camera.vp.h, tileSize)/tileSize)
    };

    scBg = {
      lf: sgf(wcam.x, bgTileSize)/bgTileSize,
      tp: sgf(wcam.y, bgTileSize)/bgTileSize,
      w: (sgf(camera.vp.w, bgTileSize)/bgTileSize)+2,
      h: (sgf(camera.vp.h, bgTileSize)/bgTileSize)+2
    };

    for ( xp = 0; xp < mapw; xp++) {
      for ( yp = scBg.tp; yp < scBg.tp + scBg.h; yp++) {

        if (tileWithinMap(xp, yp)) {

          tile = bgTiles[xp][yp];

          if (b(tile)) {
            if (tile.x > wcam.x - bgTileSize && tile.x < wcam.x + wcam.w &&
              tile.y > wcam.y - bgTileSize && tile.y < wcam.y + wcam.h) {

              if (tile !== null) {
                tile.draw(ctx);
              }
            }
          }
        }
      }
    }

    for ( xp = snc.lf - 2; xp < snc.lf + snc.w + 2; xp++) {
      for ( yp = snc.tp - 2; yp < snc.tp + snc.h + 2; yp++) {

        if (tileWithinMap(xp, yp)) {

          tile = tiles[xp][yp];
          alwaysLoadedTile = alwaysLoadedTiles[xp][yp];
          fgTile = fgTiles[xp][yp];

          if (tile !== undefined && tile !== null) {
            tile.draw(ctx);
          }

          if (alwaysLoadedTile !== undefined && alwaysLoadedTile !== null) {
            alwaysLoadedTile.draw(ctx);
          }

          if (fgTile !== undefined && fgTile !== null) {
            fgTile.draw(ctx);
          }
        }
      }
    }

    if (spaceship) {
      spaceship.draw(ctx);
    }

    for(i=0;i<parts.length;i++) {
      parts[i].draw(ctx);
    }

    for(i=0;i<players.length;i++){
      players[i].draw(ctx);
    }

    for(i=0;i<mobs.length;i++){
      mobs[i].draw(ctx);
    }

    for (i=0;i<projs.length;i++){
      projs[i].draw(ctx);
    }

    camera.end();

    for (var i = 0; i < players[0].maxhp; i++) {
      ctx.drawImage(heartempty, 32 + (i * 32), 32, 32, 32);
      if (i < players[0].hp) {
        ctx.drawImage(heart, 32 + (i * 32), 32, 32, 32);
      }
    }

    var inv = [
      { icon: ecrystal, text: players[0].ecrystal + "/9" },
      { icon: plasmaball, text: players[0].ammo },
      { icon: oiron, text: players[0].iron }
    ];

    for (var i = 0; i < inv.length; i++) {
      var item = inv[i];
      ctx.drawImage(item.icon, 32, 80 + (i * 48), 32, 32);

      ctx.save();
      ctx.font = "bold 24px monospace";
      ctx.fillStyle = "#fff";
      ctx.fillText(item.text, 72, 106 + (i * 48));
      ctx.restore();
    }

    var message = "";
    var restartMessage = "";

    if (players[0].dead) {
      message = "You died. :c";
      restartMessage="A new game will start in a sec...";
    }

    if (hasLaunched && spaceship.y < 0) {
      message = "You're on your way to orbit!";
      restartMessage="Reload to run out of fuel and crash again.";
    }

    if (restartMessage != "") {
      ctx.save();
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 240, w, 128);
      ctx.fillStyle = "#fff";
      ctx.font = "32px monospace";
      ctx.fillText(message, (w/2)-ctx.measureText(message).width/2, 310);
      ctx.font = "14px monospace";
      ctx.fillText(restartMessage, (w/2)-ctx.measureText(restartMessage).width/2, 340);
      ctx.restore();
    }

  }
  function ml() {
    update();
    draw(ctx);
    requestAnimationFrame(ml);
  }
  ael=addEventListener;
  ael('DOMContentLoaded',(e)=>{
    init();

    camera.zoomTo(300);
    ml();
  });
  ael('keydown',e=>{
    c=e.keyCode||e.which;
    k[c]=1;
  });
  ael('keyup',e=>{
    c=e.keyCode||e.which;
    k[c]=0;
  });
})(this);