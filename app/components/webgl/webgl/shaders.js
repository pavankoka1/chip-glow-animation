export const vertexShaderSource = `
attribute vec2 a_position;
attribute float a_radius;
attribute vec3 a_sparkColor;
attribute vec3 a_glowColor;
attribute float a_alpha;
attribute float a_glowRadius;
uniform vec2 u_resolution;
uniform float u_devicePixelRatio;
varying vec2 v_position;
varying float v_radius;
varying vec3 v_sparkColor;
varying vec3 v_glowColor;
varying float v_alpha;
varying float v_glowRadius;
void main(){
vec2 positionInDevicePixels=a_position*u_devicePixelRatio;
vec2 clipSpace=((positionInDevicePixels/u_resolution)*2.0-1.0)*vec2(1,-1);
gl_Position=vec4(clipSpace,0,1);
gl_PointSize=(a_radius+a_glowRadius)*2.0*u_devicePixelRatio;
v_position=a_position;
v_radius=a_radius;
v_sparkColor=a_sparkColor;
v_glowColor=a_glowColor;
v_alpha=a_alpha;
v_glowRadius=a_glowRadius;
}`;

export const fragmentShaderSource = `
precision highp float;
varying vec2 v_position;
varying float v_radius;
varying vec3 v_sparkColor;
varying vec3 v_glowColor;
varying float v_alpha;
varying float v_glowRadius;
void main(){
vec2 coord=gl_PointCoord-vec2(0.5,0.5);
float dist=length(coord)*2.0;
if(dist>1.0)discard;
float totalRadius=v_radius+v_glowRadius;
if(totalRadius<=0.0)discard;
float pointRadiusNorm=v_radius/totalRadius;
vec4 coreColor=vec4(v_sparkColor,v_alpha);
vec4 color=vec4(0.0);
if(dist<=pointRadiusNorm)color=coreColor;
if(v_glowRadius>0.0){
float glowT=dist>=pointRadiusNorm?(dist-pointRadiusNorm)/(1.0-pointRadiusNorm):0.0;
glowT=clamp(glowT,0.0,1.0);
float maxAuraAlpha=v_alpha*0.3;
float auraAlpha;
if(glowT<=0.2){
float tInZone=glowT/0.2;
auraAlpha=maxAuraAlpha*(0.85+0.15*(1.0-tInZone));
}else{
float tInFadeZone=(glowT-0.2)/0.8;
float falloff=pow(1.0-tInFadeZone,2.5);
auraAlpha=maxAuraAlpha*falloff;
}
auraAlpha=min(auraAlpha,maxAuraAlpha);
vec4 glowColor=vec4(v_glowColor,auraAlpha*0.5);
if(dist<=pointRadiusNorm){
color.rgb=mix(color.rgb,glowColor.rgb,glowColor.a);
color.a=color.a+glowColor.a*(1.0-color.a);
}else{
color=glowColor;
}
}else{
if(dist<=pointRadiusNorm)color=coreColor;
}
gl_FragColor=color;
}`;
