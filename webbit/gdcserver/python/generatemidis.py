from midiutil import MIDIFile
import csv
import numpy as np
import os
import shutil

# csv_file_path = "../logs/log0.csv"
csv_file_path = "logs/log0.csv"

with open(csv_file_path, 'r') as file:
    lines = file.readlines()
    data = [line.strip().split(',') for line in lines]
file.close()

data_len = len(data)
print("data_len: " + str(data_len))

class ListenerMidi:
  def __init__(self, ID, performer_list):
    self.ID = ID
    # map performer lists to midi file indices
    self.performer_map = {}
    self.midiFile = MIDIFile(len(performer_list))
    for i in range(len(performer_list)):
      self.performer_map[int(performer_list[i])] = i
    # force size
    self.drum_beats = np.array([[0,0,0]])
    self.mute_regions = np.array([[0,0]])
    self.tempo_changes = np.array([[0,0]])

  def add_drum_beat(self, beat, performer, drum_index):
    self.drum_beats = np.append(self.drum_beats, [[beat, performer, drum_index]], axis=0)

  def add_mute_region(self, mute_start, mute_end):
    self.mute_regions = np.append(self.mute_regions, [[mute_start, mute_end]], axis=0)

  def add_tempo_change(self, beat, tempo):
    self.tempo_changes = np.append(self.tempo_changes, [[beat, tempo]], axis=0)

  def generate_midi_file(self):
    # remove the first element from each thing
    self.drum_beats = self.drum_beats[1:]
    self.mute_regions = self.mute_regions[1:]
    self.tempo_changes = self.tempo_changes[1:]

    # remove all the drum beats that don't get played from the final drum beats
    for i in range(len(self.mute_regions)):
      mute_start = self.mute_regions[i][0]
      mute_end = self.mute_regions[i][1]
      mute_mask = (self.drum_beats[:,0] <= mute_start) | (self.drum_beats[:,0] >= mute_end)
      self.drum_beats = self.drum_beats[mute_mask]

    # remove the 0s at the beginning
    # add all the tempo changes
    for i in range(len(self.tempo_changes)):
      for j in range(len(self.performer_map)):
        self.midiFile.addTempo(j, self.tempo_changes[i][0], self.tempo_changes[i][1])

    for i in range(len(self.drum_beats)):
       time = self.drum_beats[i][0]
       track = int(self.performer_map[self.drum_beats[i][1]])
       pitch = int(self.drum_beats[i][2])
       self.midiFile.addNote(track, 0, pitch, time, 1, 127)

#     midifile_name = "../web/midifiles/listener" + str(self.ID) + "output.mid"
    midifile_name = "web/midifiles/listener" + str(self.ID) + "output.mid"
    with open(midifile_name, "wb") as midi_file:
      self.midiFile.writeFile(midi_file)
      print('done writing')

    shutil.copy2(midifile_name, "web/composer")
    shutil.copy2(midifile_name, "web/listener")
    shutil.copy2(midifile_name, "web/performer")
#     shutil.copy2(midifile_name, "../web/composer")
#     shutil.copy2(midifile_name, "../web/listener")
#     shutil.copy2(midifile_name, "../web/performer")

  def get_ID(self):
    return self.ID

  def get_mute_regions(self):
    return self.mute_regions

  def get_drum_beats(self):
    return self.drum_beats

  def get_tempo_changes(self):
    return self.tempo_changes

assert data[0][0] == 'U'
composer_IDs = [int(x) for x in data[0][1].split('.')[:-1]]
listener_IDs = [int(x) for x in data[0][2].split('.')[:-1]]
performer_IDs = [int(x) for x in data[0][3].split('.')[:-1]]
listener_midis = []

performer_listener_dicts = {}
listener_midis = {}

for i in range(len(listener_IDs)):
  listener_midi_instance = ListenerMidi(listener_IDs[i], performer_IDs)
  listener_midis[listener_IDs[i]] = listener_midi_instance

# P row syntax:
# P identifier, <performer ID>, [listener IDs], [distances between performer and listener]
# For each beat played by <performer ID>, add [distances between performer and listener][i]
# to it in [listener IDs][i]'s associated MIDI file - if listener on is true.

# now doing the rest of the file
for i in range(1, len(data), 1):

  # if registering performer distance (after listener change or
  # at start of ensemble
  if (data[i][0] == 'P'):
    performer_id = int(data[i][1])
    listener_IDs = [int(x) for x in data[i][2].split('.')[:-1]]
    listener_distances = [int(x) for x in data[i][3].split('.')[:-1]]
    assert(len(listener_IDs) == len(listener_distances))
    performer_listener_dict = {}
    for j in range(len(listener_IDs)):
      performer_listener_dict[listener_IDs[j]] = listener_distances[j]
    performer_listener_dicts[performer_id] = performer_listener_dict

  # if tempo change
  elif (data[i][0] == 'T'):
    # get data from line
    beat = float(data[i][1])
    tempo = float(data[i][2]) * 60.0
    # apply tempo change to all listener midis
    for value in listener_midis.values():
      value.add_tempo_change(beat, tempo)

  # if drum hit
  elif (data[i][0] == 'H'):
    # get data from line
    beat = float(data[i][1])
    performer_ID = int(data[i][2])
    drum_index = int(data[i][3])
    # get corresponding performer dict
    pl_dict = performer_listener_dicts[performer_ID]
    for value in listener_midis.values():
      # get downstream listener distance from performer
      dl_distance = float(pl_dict[value.get_ID()])
      # add them and add to listener midi
      value.add_drum_beat(beat+dl_distance, performer_ID, drum_index)

  # if listener moved
  elif (data[i][0] == 'L'):
    listener_ID = int(data[i][1])
    mute_start = float(data[i][2])
    mute_end = float(data[i][3])
    listener_midis[listener_ID].add_mute_region(mute_start, mute_end)

for value in listener_midis.values():
  value.generate_midi_file()