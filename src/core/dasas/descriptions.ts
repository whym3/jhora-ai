// The dasa descriptions JHora shows with the dasa pane's "Quick Info" button (0x44be70):
// MessageBox(text = obj+0x76d34, the description each builder stores, caption = "Quick Info on " +
// the title cut after the first "Dasa" / "dasa"). Texts copied from jhora.exe, by dasa slot
// (yearDefinition.ts); Paryaaya (37) has one per builder: 0x4162b0 fixed, 0x416650 dual and
// 0x416a10 movable lagna.

export const DASA_DESCRIPTIONS: Record<number, string> = {
  0: "Vimsottari dasa is a general purpose nakshatra dasa that shows all the events in a native's life from the vantage point of native's mind. It tracks the changes throughout one's life. It is one of the most important of all dasas in Kali Yuga. Though it is normally started from Moon's nakshatra, it can also be started from Kshema, Utpanna and Adhana taras, lagna, Maandi and Trisphuta. Click the Options button to choose a variation.",
  1: "Ashtottari dasa is a popular nakshatra dasa. Some hold it to be universally applicable. Some apply it for daytime births in Krishna paksha and night time births in Sukla paksha. Some apply it when Rahu is in a trine or quadrant from lagna lord (but not in lagna). As it is based on a 108-year cycle, some use it is an ayur dasa and time death from it. As only chara karakas figure in it, some use it as a dasa that shows sustenance and raja yogas.",
  2: "Kalachakra dasa is a general purpose nakshatra dasa that is based on Moon's navamsa. It shows all the events in a native's life from the vantage point of the native's inner spirit and motivation. Parasara called it the most respectable of all dasas. It was taught by Lord Shiva to Parvati.",
  3: "Yogini dasa is a tantrik dasa that shows the impact of various Yoginis on a person at various times.",
  4: "Dwi-saptati sama dasa is a conditional nakshatra dasa that is applicable if lagna lord is in 7th or 7th lord is in lagna.",
  5: "Shat-trimsa sama dasa is a conditional nakshatra dasa that is applicable for daytime births in Sun's hora and night-time births in Moon's hora.",
  6: "Dwadasottari dasa is a conditional nakshatra dasa that is applicable if lagna is in Venusian amsa.",
  7: "Chaturaseeti sama dasa is a conditional nakshatra dasa that is applicable if 10th lord is in 10th.",
  8: "Sataabdika dasa is a conditional nakshatra dasa that is applicable if lagna is in vargottama.",
  9: "Shodasottari dasa is a conditional nakshatra dasa that is applicable if lagna in Moon's hora in Krishna paksha or in Sun's hora in Sukla paksha.",
  10: "Panchottari dasa is a conditional nakshatra dasa that is applicable if lagna is in Cancer in rasi and dwadasamsa.",
  11: "Shashti-hayani dasa is a conditional nakshatra dasa that is applicable if Sun is in lagna.",
  12: "Saptarshi nakshatra dasa is a nakshatra dasa that was taught by Pt Rath. It was not mentioned by any rishis.",
  25: "Narayana dasa is a general purpose rasi dasa that can be computed for all divisional charts. It is the most versatile dasa taught by maharshis. It is actually a suite of dasas that encompasses Chara dasa, Lagnamsaka dasas and Padanadamsa dasas. Narayana dasa uses the regular progression for movable signs ruled by Brahma (Creator), every-sixth progression for fixed signs ruled by Shiva (Destroyer) and trinal progression for dual signs ruled by Vishnu (Sustainer). This is the most natural progression and shows how various aspects of a person change with time and how they impact various areas of one's life. The basic Narayana dasa of rasi chart tracks how lagna changes throughout one's life and shows the changing environments that one comes under. Narayana rules effort, environment and sustenance. Narayana dasa shows exactly that.",
  26: "Lagnamsaka dasa is a variation of Narayana dasa, which shows the physical fructification of various environmental influences such as dharma.",
  27: "Padanaathaamsa dasa is a variation of Narayana dasa, which shows how one's abilities, karma, learning, spiritual activities etc impact one's image and status with changing time.",
  28: "Just as Narayana dasa tracks the movement of lagna with time, Sudasa is a rasi dasa that tracks the movement of Sree lagna with time. Sree lagna is the residence of Lakshmi in one's chart. Sudasa tracks the changes in Lakshmi's residence with time and shows Her blessings. It shows prosperity, fruition and well-being. It can show everything from power (Rajya Lakshmi's blessing) to money (Dhana Lakshmi's blessing) to child-birth (Santhana Lakshmi's blessing) to vehicles (Vahana Lakshmi's blessing) to moksha (Moksha Lakshmi's blessing). While Narayana dasa shows effort and environment, Sudasa shows well-being and prosperity. For timing wealth and power, it is particularly indispensable.",
  29: "Drigdasa is a phalita dasa that shows religious activities and spiritual evolution.",
  30: "Lagna kendradi rasi dasa is a rasi dasa that shows prosperity of various aspects of a person. It can show financial prosperity, prosperity of raja yogas, prosperity of parivraja yogas etc.",
  31: "Atma karaka kendradi rasi dasa is a rasi dasa that shows matters related to soul. It shows the experiences of the soul in this life.",
  32: "Trikona dasa is a rasi dasa that shows how the native follows purusharthas (dharma/duty, artha/wealth, kama/desires, moksha/emancipation).",
  33: "Chara dasa is a general purpose rasi dasa that was taught by Parasara. It is a part of the Narayana dasa system. Some scholars suggest that Chara dasa applies only to natives with lagna in a chara rasi, i.e. movable sign.",
  34: "Chara dasa is a general purpose rasi dasa that was taught by Parasara. It is a part of the Narayana dasa system. Some scholars suggest that Chara dasa applies only to natives with lagna in a chara rasi, i.e. movable sign. Author K.N.Rao modified Parasara's teachings and some people follow him instead of Parasara.",
  35: "Chara dasa is a general purpose rasi dasa that was taught by Parasara and Jaimini. Scholar Iranganti Rangacharya's interpretation of Jaimini's teachings on chara dasa is based on the commentary by Raghava Bhatta and Nrisimha Suri. Implementation of this dasa was done by Shanmukha Teli.",
  36: "Yogardha dasa is a rasi dasa that was taught by Parasara and Jaimini. Its application should be learnt from a competent guru.",
  38: "Shoola dasa is an important ayur dasa. It is a rasi dasa. It shows the force of Shiva (Destroyer). It shows death and destruction of native. Its variations that are started from various houses show deaths of various relatives.",
  39: "Niryana shoola dasa is an important ayur dasa. It is a rasi dasa. It shows the motion of prana. It is used in timing death.",
  40: "Brahma dasa is a rasi dasa. It is an important ayur dasa that sheds light on the cycle of life-death-and-life.",
  41: "Sthira dasa is a rasi dasa that was taught by Parasara and Jaimini. In Indian philosophy, death is nothing but praana (life) becoming sthira (fixed). Sthira dasa is an ayur dasa and shows death.",
  42: "Mandooka dasa of Rudramsa (D-11) shows death, wars and destruction. It is an ayur dasa. It is very important in predicting the outcomes of wars.",
  43: "Mandooka dasa of K.N. Rao is applicable to people with 4 or more planets in quadrants from lagna.",
  44: "Navamsa dasa is an important ayur dasa. It is a rasi dasa. Unless navamsa dasa sign contains or aspects Yama (Lord of death) in the 3rd house from arudha lagna, death cannot come.",
  45: "Varnada dasa is an important ayur dasa. It is a rasi dasa. It shows the force of Shiva (Destroyer). It shows death and destruction of native. Its variations that are started from various houses show deaths of various relatives.",
  60: "Moola dasa is a general purpose planetary dasa that is good at showing various phases in life. This was the most popular dasa at the time of Varahamihira and Kalyana Verma (author of Saravali). This dasa shows the root (moola) of events, i.e. past karma. Use D-60 (past life) and rasi (this life) with Moola dasa to judge how past life's karma influences this life's events. This is one of the finest dasas we know today.",
  61: "Naisargika dasa is a general purpose phalita dasa that throws light on the changing nature of a person with changing time.",
  62: "Tara dasa is a general purpose planetary dasa that is applicable if all the four quadrants from lagna are occupied by planets (Rahu and Ketu are considered as planets here). It is basically Moola dasa without Moolatrikona correction and with dasa sesham. This is a hybrid between Vimsottari dasa and Moola dasa.",
  63: "Kaala dasa is based on the time of the day when birth happened.",
  64: "AK kendradi graha dasa is a general purpose planetary dasa that is good at showing the experiences of the soul.",
  65: "Patyayini dasa is used with dasa pravesh charts (period commencement charts) to finely time events in a dasa. It is most commonly used in Tajaka annual and monthly charts. The special feature of this dasa is that lagna has dasa along with planets. In a dasa pravesh chart, dasa sign is the most important reference and lagna of the chart joins planets and becomes a useful parameter. So it also has a dasa.",
  66: "Sudarsana Chakra Dasa is the best tool for predicting annual, monthly and daily fortune according to Parasara. This dasa is found by progressing lagna, Moon and Sun at the rate of one sign per year.",
  67: "BuddhiGatiDasaVarga is defined in Agni Purana with no specific name. It It shows the direction of buddhi. It shows which planet sits on head at a given time. That planet can be propitiated.",
  68: "Rasi-Bhukta Vimsottari dasa is a variation of Vimsottari dasa, where dasas are divided equally among 12 rasis when finding antardasas. Pratyantardasas belong to eight planets in kakshya orders. This is analyzed using prastara ashtakavarga and transits.",
  69: "Tithi Ashtottari dasa is a very useful variation of Ashtottari dasa. It is based on tithis instead of nakshatras. It is particularly useful in Tithi Pravesha charts, which are the lunar counterpart of the Tajaka solar return charts.",
  70: "Yoga Vimsottari dasa is a very useful variation of Vimsottari dasa. It is based on yogas instead of nakshatras. It is particularly useful in Yoga Pravesha charts, which are a soli-lunar variant of the Tajaka solar return charts. This dasa is a result of the research of PVR Narasimha Rao.",
  71: "Karana Chaturaseeti sama dasa is a special variation of the conditional nakshatra dasa that is applicable in Tithi/Karana Pravesha charts for seeing events relating to karana, i.e. earthy nature.",
  72: "Yogini dasa is a tantrik dasa that shows the impact of various Yoginis on a person. Tithi Yogini dasa is a variation that is based on tithis instead of nakshatras. It is not a commonly employed dasa.",
  73: "Karaka dasa is used to see the effects of chara karakas in life",
  74: "Chakra dasa is based on the time of the day when birth happened.",
};

/** Paryaaya dasa descriptions by lagna modality (0 movable, 1 fixed, 2 dual). */
export const PARYAAYA_DESCRIPTIONS = ["This dasa applies to natives with lagna in a movablesign. It shows illnesses, litigations && worries.", "This dasa applies to natives with lagna in a fixed sign. It shows illnesses, litigations && worries.", "This dasa applies to natives with lagna in a dual sign. It shows illnesses, litigations && worries."] as const;

/** FUN_0044be70's caption: "Quick Info on " + title, cut after the first "Dasa", else "dasa", else empty. */
export function quickInfoCaption(title: string): string {
  const c = `Quick Info on ${title}`;
  let i = c.indexOf('Dasa');
  if (i < 0) i = c.indexOf('dasa');
  return i < 0 ? '' : c.slice(0, i + 4);
}
