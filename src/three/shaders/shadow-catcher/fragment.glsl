varying vec2 vUv;
varying vec3 vWorld;

uniform sampler2D uTexture;
uniform vec3 uColorBackground;
uniform vec3 uColorShadow;

/**
 * The avatar's contact shadow is baked into uTexture at his standing spot, so it
 * would stay behind once the goodbye walk starts. uFigureBlend lifts that patch
 * out; objects/contact/figure-shadow.ts then carries a fresh one along with him,
 * which also works past this quad's edge. At 0 the term vanishes and this is the
 * original shader.
 */
uniform vec2 uFigureFrom;
uniform float uFigureBlend;
uniform float uFigureRadius;

void main() {
    vec4 shadow = texture2D(uTexture, vUv);

    float erase = 1.0 - smoothstep(uFigureRadius * 0.55, uFigureRadius, distance(vWorld.xz, uFigureFrom));
    float intensity = mix(shadow.r, 1.0, uFigureBlend * erase);

    vec3 color = mix(uColorShadow.rgb, uColorBackground.rgb, intensity);

    gl_FragColor = vec4(color, 1.);
}
