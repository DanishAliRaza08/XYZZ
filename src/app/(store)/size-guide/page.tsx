import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";

export const metadata: Metadata = { title: "Size guide" };


export default function Page() {
  return (
    <InfoPage title="Size guide" eyebrow="Help">
<p>Our sizes follow standard UK sizing. Where a product has specific measurements, they are shown on the product page. If you're between sizes, we recommend sizing up for children's clothing to allow room to grow.</p>
<h2>Women</h2>
<div className="table-wrap"><table className="table"><thead><tr><th>UK size</th><th>US size</th><th>Bust (cm)</th><th>Waist (cm)</th><th>Hip (cm)</th></tr></thead><tbody>
<tr><td>8</td><td>4</td><td>82</td><td>65</td><td>90</td></tr>
<tr><td>10</td><td>6</td><td>87</td><td>70</td><td>95</td></tr>
<tr><td>12</td><td>8</td><td>92</td><td>75</td><td>100</td></tr>
<tr><td>14</td><td>10</td><td>97</td><td>80</td><td>105</td></tr>
<tr><td>16</td><td>12</td><td>102</td><td>85</td><td>110</td></tr>
<tr><td>18</td><td>14</td><td>109.5</td><td>92.5</td><td>117.5</td></tr>
</tbody></table></div>
<h2>Children</h2>
<div className="table-wrap"><table className="table"><thead><tr><th>Age</th><th>Height (cm)</th><th>Chest (cm)</th><th>Waist (cm)</th></tr></thead><tbody>
<tr><td>2–3y</td><td>92–98</td><td>53</td><td>51</td></tr>
<tr><td>3–4y</td><td>98–104</td><td>55</td><td>52</td></tr>
<tr><td>4–5y</td><td>104–110</td><td>57</td><td>53</td></tr>
<tr><td>5–6y</td><td>110–116</td><td>59</td><td>54</td></tr>
<tr><td>6–7y</td><td>116–122</td><td>61</td><td>55</td></tr>
<tr><td>7–8y</td><td>122–128</td><td>64</td><td>57</td></tr>
<tr><td>8–9y</td><td>128–134</td><td>67</td><td>58</td></tr>
<tr><td>9–10y</td><td>134–140</td><td>70</td><td>60</td></tr>
<tr><td>11–12y</td><td>146–152</td><td>76</td><td>63</td></tr>
</tbody></table></div>
<h2>Baby</h2>
<div className="table-wrap"><table className="table"><thead><tr><th>Age</th><th>Height (cm)</th><th>Weight (kg)</th></tr></thead><tbody>
<tr><td>0–3m</td><td>up to 62</td><td>up to 6</td></tr>
<tr><td>3–6m</td><td>62–68</td><td>6–8</td></tr>
<tr><td>6–12m</td><td>68–80</td><td>8–10</td></tr>
<tr><td>12–18m</td><td>80–86</td><td>10–12</td></tr>
<tr><td>18–24m</td><td>86–92</td><td>12–14</td></tr>
</tbody></table></div>
<p className="muted small">Measurements are a guide. Check the measurements you add to each product before publishing.</p>
    </InfoPage>
  );
}
