/* Shared figure model and pose building blocks, used by every mode.
   World units: y up, the ground at y = 0, legs 80 long. Angles in degrees: 0 = pointing down, 90 = right, 180 = up.
   Side view: the figure faces right; "L" limbs are the far side, "R" the near side.
   Pose fields: hx, hy hip; torso, neck angles; arch bends the spine; ua/la upper and lower arm; th/sh thigh and shin
   (forward kinematics) or fL/fR ankle targets with kL/kR knee hints (inverse kinematics); hL/hR hand targets with
   ehL/ehR elbow hints; ftL/ftR foot angle; face; glow (breath glow at the belly). */
"use strict";
const D=Math.PI/180;
const LEN={torso:52,neck:7,head:11,ua:29,la:27,th:40,sh:40,hipW:9,shW:16};
const FRONT={hx:0,hy:80,torso:180,arch:0,neck:180,face:0,glow:0,px:1,suaL:1,slaL:1,suaR:1,slaR:1,uaL:-10,laL:-6,uaR:10,laR:6,fL:[-11,0],fR:[11,0],kL:[-1,.15],kR:[1,.15]};
const SIDE={hx:0,hy:80,torso:180,arch:0,neck:180,face:1,glow:0,px:1,suaL:1,slaL:1,suaR:1,slaR:1,uaL:-4,laL:4,uaR:4,laR:10,fL:[-3,0],fR:[3,0],kL:[1,.1],kR:[1,.1],
 car:0,hc:1,fcL:1,fcR:1,hL:null,hR:null,hcL:0,hcR:0,ehL:[0,1],ehR:[0,1],ftL:null,ftR:null,strap:"",flip:0,fx:0,db:0};
const HIPS_F={uaL:-40,laL:50,uaR:40,laR:-50};
const CHAMBER={uaL:-30,laL:25,uaR:30,laR:-25};
const BELLY={uaL:-20,laL:70,uaR:20,laR:-70};
const HORSE={hy:54,fL:[-46,0],fR:[46,0]};
const HIPS_S={uaL:-28,laL:62,uaR:-25,laR:65};
const SEATED={hy:10,thL:-100,shL:88,thR:100,shR:-88,uaL:-15,laL:70,uaR:15,laR:-70,glow:.4}; /* cross-legged, hands in the lap */
const BEHIND_R={uaR:30,laR:-60}; /* back of the right hand resting on the lower back */

/* ---------- the Reformer (Pilates mode) ----------
   Side view: footbar and platform on the right, risers and pulleys on the left.
   car = carriage travel toward the risers; hc / fcL / fcR = hips / feet ride on the carriage; hcL / hcR = hands ride on it;
   strap = "hands" or "feet" in the straps; flip = the figure faces the risers (authored facing right, mirrored about fx). */
const RF={top:30,bar:[112,62],pulley:[-121,79],carL:-34,carR:66};
const SUP={hx:60,hy:39,torso:-90,neck:-86,uaL:92,laL:94,uaR:92,laR:94,kL:[0,1],kR:[0,1]}; /* lying on the back, head on the headrest */
const ONBAR={fcL:0,fcR:0,fL:[103,57],fR:[104.5,57.5],ftL:122,ftR:122}; /* balls of the feet on the footbar */
const TABLE={thL:182,shL:92,thR:178,shR:90}; /* legs in tabletop */
const KNEEL={hx:46,hy:70,fL:[6,33],fR:[8,33],kL:[1,-.6],kR:[1,-.6]}; /* kneeling, feet against the shoulder blocks */
const BAR={hL:[111,64],hR:[112.5,64]}; /* hands on the footbar */
const BOX={x0:-26,x1:56,h:22};

/* ---------- on the mat (Yoga and Strength) ----------
   Mat poses are side view unless noted. Hands on the floor use hand targets (hL / hR). */
const MAT_SUP={hx:0,hy:6,torso:-90,neck:-90,uaL:90,laL:90,uaR:92,laR:92,thL:90,shL:90,thR:90,shR:90,ftL:180,ftR:180}; /* lying on the back, head to the left */
const MAT_PRONE={hx:0,hy:6,torso:-90,neck:-92,face:-1,thL:90,shL:90,thR:90,shR:90,ftL:90,ftR:90,uaL:90,laL:90,uaR:92,laR:92}; /* lying face down, head to the left */
const QUAD={hx:-12,hy:43,torso:90,neck:100,thL:0,shL:-90,thR:0,shR:-90,ftL:-90,ftR:-90,hL:[38,0],hR:[39,0],ehL:[-1,0],ehR:[-1,0]}; /* hands and knees */
const KNEES={hy:43,thL:0,shL:-90,thR:0,shR:-90,ftL:-90,ftR:-90}; /* kneeling up: thighs vertical, shins on the floor behind */
const PLANK={hx:-5,hy:36,torso:112,neck:116,fL:[-78,6],fR:[-77,6],ftL:30,ftR:30,hL:[41,0],hR:[42,0],ehL:[-1,0],ehR:[-1,0],kL:[0,1],kR:[0,1]};
const DOG={hx:0,hy:74,torso:46,neck:40,fL:[-34,0],fR:[-33,0],kL:[0,1],kR:[0,1],hL:[78,0],hR:[79,0],ehL:[1,1],ehR:[1,1]};
const LONGSIT={hy:5,torso:180,thL:90,shL:90,thR:90,shR:90,ftL:180,ftR:180,uaL:4,laL:4,uaR:6,laR:6}; /* sitting tall, legs long in front */
const DBH={db:1}; /* holding dumbbells */
