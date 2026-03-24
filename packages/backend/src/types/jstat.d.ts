declare module "jstat" {
  interface Distribution {
    pdf(x: number, ...params: number[]): number;
    cdf(x: number, ...params: number[]): number;
    inv(p: number, ...params: number[]): number;
    mean(...params: number[]): number;
    median(...params: number[]): number;
    mode(...params: number[]): number;
    sample(...params: number[]): number;
    variance(...params: number[]): number;
  }

  interface JStatStatic {
    studentt: Distribution;
    ttest(t: number, df: number, twoSided: boolean): number;
  }

  const jStat: JStatStatic;
  export = jStat;
}
