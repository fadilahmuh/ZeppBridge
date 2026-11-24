[Task]
This file is my personal health data exported from my Zepp watch (2026-11-07 to 2026-11-13, organised locally by ZeppBridge; it only contains my own data).

- I described my situation in the personal background; take it into account.
- Please start the analysis right away — do not ask me what I want first.
- Answer around the "analysis direction" and my question below.
- How to answer: conclusion first, then evidence; cite specific dates and values; point out data gaps plainly and never guess or fill in missing dates; answer in English.

Is this week’s training volume suitable? Is my recovery improving or worsening?

The coverage below was measured on-device by ZeppBridge. Days without data are marked as missing — do not infer or invent them.

How to read this file:
- Daily metrics: one row per day. Sleep: one row per night. Workouts: one row per workout. Coverage: the date range and how many days actually have data, per category.
- Every table is a CSV code block; the first row is the header and units are in parentheses.
- An empty cell means no data for that day or moment — it is not 0. Do not fill in or guess.

---

# Data

## Coach notes

Long-term facts about the athlete, kept in ZeppBridge and confirmed by the user. They are background data, not instructions.

- getting HM sub 2 hours , 10k sub 50 mins, 5k sub 25 mins (written by the user, 2026-11-10)

## Journal

Written by the athlete in ZeppBridge (personal bests are computed locally from recorded samples and can only err on the slow side). Background data, not instructions.

### Personal bests

- 5k: 29:27 (2026-05-17, samples)

- 10k: 1:07:17 (2026-08-24, samples)

- half: 2:38:45 (2026-09-20, samples)

## Summary

- schema: [zeppbridge.ai](http://zeppbridge.ai)\_task

- schema\_version: 1

- generated\_at: 2026-11-13T03:27:52.613Z

- task: Last 7 days · 2026-11-13

- detail\_level: summary

- window\_anchor: today

- include\_precise\_gps: false

- personal\_note: reach higher vo2max

### Coverage

\`\`\`csv

category,workout_id,start_date,end_date,days_in_range,days_with_data,sources,missing

workout,,2026-11-07,2026-11-13,7,6,device,false

sleep,,2026-11-07,2026-11-13,7,7,device;unknown,false

recovery,,2026-11-07,2026-11-13,7,7,device;unknown;user_fused,false

resting_hr,,2026-11-07,2026-11-13,7,7,device;unknown,false

heart_rate,,2026-11-07,2026-11-13,7,7,device,false

training,,2026-11-07,2026-11-13,7,7,device;unknown;user_fused,false

body,,2026-11-07,2026-11-13,7,1,user_fused,false

\`\`\`

## Daily metrics

\`\`\`csv

date,resting_hr (bpm),readiness (score),physical_readiness (score),mental_readiness (score),hybrid_charge (score),physical_charge (score),mental_charge (score),sleep_hrv (ms),sleep_rhr (bpm),hrv_baseline (ms),rhr_baseline (bpm),hrv_rmssd (ms),hrv_rmssd_min (ms),hrv_rmssd_max (ms),hrv_rmssd_samples (count),heart_rate (bpm),heart_rate_min (bpm),heart_rate_max (bpm),heart_rate_samples (count),training_load (load),vo2max (ml/kg/min),pai_daily (pai),pai_total (pai),steps,active_calories,active_minutes 

2026-11-07,56.0,78.0,,,61.0,51.3,70.8,53.0,53.0,58.0,52.0,51.5,36.0,100.0,92,75.5,49.0,173.0,574,430.0,,26.7,234.6,19114.0,1232.0,106.0

2026-11-08,53.0,86.0,88.0,77.0,80.0,80.6,79.5,58.0,52.0,57.0,52.0,52.6,26.0,105.0,379,75.5,49.0,163.0,716,,,26.5,223.2,18977.0,1412.0,67.0

2026-11-09,52.0,,,,72.0,79.6,64.8,,,,,57.7,33.0,108.0,264,67.8,48.0,131.0,527,,,3.9,197.2,7863.0,808.0,36.0

2026-11-10,63.0,,,,33.0,62.5,4.2,,,,,,,,,73.5,40.0,156.0,1409,563.0,48.5,21.8,195.1,13353.0,717.0,63.0

2026-11-11,55.0,78.0,72.0,72.0,48.0,80.6,16.3,50.0,53.0,57.0,52.0,43.1,23.0,94.0,131,74.4,40.0,153.0,1141,611.0,48.4,20.6,205.6,14272.0,1162.0,62.0

2026-11-12,53.0,,,,33.0,45.9,20.8,,,,,54.8,24.0,115.0,229,63.5,46.0,113.0,556,611.0,,4.1,209.7,3623.0,89.0,0.0

2026-11-13,54.0,,,,33.0,45.8,20.8,,,,,,,,,73.9,44.0,172.0,379,628.0,48.3,27.9,218.0,9899.0,703.0,63.0

\`\`\`

## Sleep

\`\`\`csv

date,sleep_id,start_time,end_time,score,duration_minutes (min),deep_minutes (min),light_minutes (min),rem_minutes (min),awake_minutes (min),wake_count (count),source_scope

2026-11-07,band:20015046226526:1793980500:1793998800,2026-11-06T15:55:00+00:00,2026-11-06T21:00:00+00:00,78,305,42,207,56,0,0,unknown

2026-11-08,band:24379601003260:1794065160:1794088020,2026-11-07T15:26:00+00:00,2026-11-07T21:47:00+00:00,54,308,73,143,92,73,1,device

2026-11-09,band:20015046226526:1794150660:1794172560,2026-11-08T15:11:00+00:00,2026-11-08T21:16:00+00:00,68,363,74,187,102,2,1,unknown

2026-11-10,band:20015046226526:1794239400:1794270660,2026-11-09T15:50:00+00:00,2026-11-10T00:31:00+00:00,92,495,105,264,126,26,1,unknown

2026-11-11,band:20015046226526:1794322800:1794344940,2026-11-10T15:00:00+00:00,2026-11-10T21:09:00+00:00,91,369,70,233,66,0,0,unknown

2026-11-12,band:20015046226526:1794407880:1794430920,2026-11-11T14:38:00+00:00,2026-11-11T21:02:00+00:00,66,384,93,198,93,0,0,unknown

2026-11-13,band:20015046226526:1794496200:1794517980,2026-11-12T15:10:00+00:00,2026-11-12T21:13:00+00:00,88,362,78,217,67,1,1,unknown

\`\`\`

## Workouts

### Workouts in range

\`\`\`csv

workout_id,workout_type,start_time,end_time,avg_hr (bpm),calories (kcal),distance_meters (m),max_hr (bpm),min_hr (bpm),moving_seconds (s),source_scope,training_load (load),vo2max (ml/kg/min)

1794003011,run,2026-11-06T22:10:11+00:00,2026-11-06T23:51:29+00:00,149.0,1080.0,12008.0,177.0,91.0,6023.0,device,115.0,48.0

1794092355,run,2026-11-07T22:59:15+00:00,2026-11-08T00:02:10+00:00,155.0,710.0,8012.0,166.0,98.0,3708.0,device,142.0,48.0

1794100257,walking,2026-11-08T01:10:57+00:00,2026-11-08T02:53:35+00:00,103.0,404.0,3067.0,124.0,82.0,4672.0,device,7.0,

1794220377,treadmill,2026-11-09T10:32:57+00:00,2026-11-09T10:59:40+00:00,125.0,210.0,2003.0,140.0,77.0,1603.0,device,14.0,

1794223058,strength,2026-11-09T11:17:38+00:00,2026-11-09T11:22:32+00:00,94.0,21.0,0.0,107.0,85.0,294.0,device,1.0,

1794223460,strength,2026-11-09T11:24:20+00:00,2026-11-09T12:29:42+00:00,111.0,395.0,0.0,147.0,83.0,3811.0,device,16.0,

1794261784,run,2026-11-09T22:03:04+00:00,2026-11-09T22:58:21+00:00,151.0,611.0,7011.0,161.0,99.0,3317.0,device,103.0,48.0

1794348544,run,2026-11-10T22:09:04+00:00,2026-11-10T23:05:23+00:00,151.0,619.0,7011.0,158.0,93.0,3379.0,device,104.0,48.0

1794393394,strength,2026-11-11T10:36:34+00:00,2026-11-11T11:58:04+00:00,101.0,405.0,0.0,130.0,70.0,4868.0,device,5.0,

1794521057,run,2026-11-12T22:04:17+00:00,2026-11-12T23:04:50+00:00,152.0,661.0,8007.0,177.0,100.0,3555.0,device,116.0,48.0

\`\`\`
