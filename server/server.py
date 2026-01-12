#! /usr/bin/env python

import os
import uuid
import re
import subprocess
import argparse
import json
import gzip
from subprocess import call
from flask import Flask, send_file, flash, send_from_directory, request, redirect, url_for, jsonify
from flask_cors import CORS, cross_origin
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)
PADLOCKWS = os.path.dirname(os.path.abspath(__file__))

app.config['PADLOCK'] = os.path.join(PADLOCKWS, "..")
app.config['UPLOAD_FOLDER'] = os.path.join(app.config['PADLOCK'], "data")
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024   #maximum of 8MB

def allowed_file(filename):
   return '.' in filename and filename.rsplit('.', 1)[1].lower() in set(['tsv'])

uuid_re = re.compile(r'(^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-{0,1}([ap]{0,1})([cj]{0,1})$')
def is_valid_uuid(s):
   return uuid_re.match(s) is not None

@app.route('/api/v1/download/<uuid>/<ext>')
def download(uuid, ext):
    if is_valid_uuid(uuid):
        filename = "padlock_" + uuid + "." + ext
        if allowed_file(filename):
            sf = os.path.join(app.config['UPLOAD_FOLDER'], uuid[0:2])
            if os.path.exists(sf):
                if os.path.isfile(os.path.join(sf, filename)):
                    return send_file(os.path.join(sf, filename), download_name=filename)
    return "File does not exist!"

@app.route('/api/v1/upload', methods=['POST'])
def generate():
   if request.method == 'POST':
      uuidstr = str(uuid.uuid4())

      # Get subfolder
      sf = os.path.join(app.config['UPLOAD_FOLDER'], uuidstr[0:2])
      if not os.path.exists(sf):
         os.makedirs(sf)

      # Run dicey
      jsonfile = os.path.join(sf, "padlock_" + uuidstr + ".json.gz")
      outfile = os.path.join(sf, "padlock_" + uuidstr + ".tsv")
      logfile = os.path.join(sf, "padlock_" + uuidstr + ".log")
      errfile = os.path.join(sf, "padlock_" + uuidstr + ".err")
      with open(logfile, "w") as log:
         with open(errfile, "w") as err:
            # Gene names
            if 'geneText' in request.form.keys():
               geneData = request.form['geneText']
               geneData = geneData.replace('\r\n','\n')
               if geneData == '':
                  return jsonify(errors = [{"title": "Please provide a gene name!"}]), 400
               ffaname = os.path.join(sf, "padlock_" + uuidstr + ".gene.lst")
               with open(ffaname, "w") as geneFile:
                  geneFile.write(geneData)
            if 'armLength' in request.form.keys():
               armLength = int(request.form['armLength'])
            overlap = 'false'
            if 'overlap' in request.form.keys():
               overlap = request.form['overlap']
            probe = 'false'
            if 'probe' in request.form.keys():
               probe = request.form['probe']
            hamming = 'false'
            if 'hamming' in request.form.keys():
               hamming = request.form['hamming']
            absent = 'false'
            if 'absent' in request.form.keys():
               absent = request.form['absent']
            if (armLength < 10) or (armLength > 50):
               return jsonify(errors = [{"title": "Arm length needs to be in size interval [10, 50]!"}]), 400
            editDist = 1
            if 'editDist' in request.form.keys():
               editDist = int(request.form['editDist'])
            featGtf = "exon"
            if 'featGtf' in request.form.keys():
               featGtf = request.form['featGtf']
            attrGtf = "gene_id"
            if 'attrGtf' in request.form.keys():
               attrGtf = request.form['attrGtf']
            anchorSeq = 'TGCGTCTATTTAGTGGAGCC'
            if 'anchorSeq' in request.form.keys():
               anchorSeq = request.form['anchorSeq']
            spacerLeft = 'TCCTC'
            if 'spacerLeft' in request.form.keys():
               spacerLeft = request.form['spacerLeft']
            spacerRight = 'TCTTT'
            if 'spacerRight' in request.form.keys():
               spacerRight = request.form['spacerRight']
            colorAmount = 4
            if 'colorAmount' in request.form.keys():
               colorAmount = int(request.form['colorAmount'])
            codeLength = 6
            if 'codeLength' in request.form.keys():
               codeLength = int(request.form['codeLength'])
            barname = "../barcodes/colors" + str(colorAmount) + "length" + str(codeLength) + ".fa.gz"
            barpath = os.path.join(PADLOCKWS, barname)
            # Custom barcodes and color codes
            if 'barcodeFile' in request.files:
               fexp = request.files['barcodeFile']
               if fexp.filename != '':
                  barpath = os.path.join(sf, "padlock_" + uuidstr + "_" + secure_filename(fexp.filename))
                  fexp.save(barpath)
            if not os.path.isfile(barpath):
               return jsonify(errors = [{"title": "Barcode file does not exist: " + barpath}]), 400
            if 'genome' in request.form.keys():
               genome = request.form['genome']
               if genome == '':
                  return jsonify(errors = [{"title": "Please select a genome!"}]), 400
               genome = os.path.join(app.config['PADLOCK'], "fm", genome)
               if not os.path.isfile(genome):
                  return jsonify(errors = [{"title": "Genome does not exist: " + genome}]), 400
               try:
                  gtfname = genome.replace('.fa.gz', '.gtf.gz')
                  if not os.path.isfile(gtfname):
                     return jsonify(errors = [{"title": "GTF file does not exist: " + gtfname}]), 400
                  flags = ''
                  if hamming == 'true':
                     if len(flags) == 0:
                        flags = '-n'
                     else:
                        flags += 'n'
                  if overlap == 'true':
                     if len(flags) == 0:
                        flags = '-v'
                     else:
                        flags += 'v'
                  if probe == 'true':
                     if len(flags) == 0:
                        flags = '-p'
                     else:
                        flags += 'p'
                  if absent == 'true':
                     if len(flags) == 0:
                        flags = '-e'
                     else:
                        flags += 'e'
                  if len(flags) == 0:
                     return_code = call(['dicey', 'padlock', '-a', anchorSeq, '-l', spacerLeft, '-r', spacerRight, '-d', str(editDist), '-m', str(armLength), '-g', genome, '-t', gtfname, '-u', attrGtf, '-f', featGtf, '-j', jsonfile, '-o', outfile, '-i', os.path.join(PADLOCKWS, "../primer3_config/"), '-b', barpath, ffaname], stdout=log, stderr=err)
                  else:
                     return_code = call(['dicey', 'padlock', flags, '-a', anchorSeq, '-l', spacerLeft, '-r', spacerRight, '-d', str(editDist), '-m', str(armLength), '-g', genome, '-t', gtfname, '-u', attrGtf, '-f', featGtf, '-j', jsonfile, '-o', outfile, '-i', os.path.join(PADLOCKWS, "../primer3_config/"), '-b', barpath, ffaname], stdout=log, stderr=err)
               except OSError as e:
                  return jsonify(errors = [{"title": "Binary dicey not found!"}]), 400               
      datajs = dict()
      datajs["errors"] = []
      with open(errfile, "r") as err:
         errInfo = ": " + err.read()
         if len(errInfo) > 3 or return_code != 0:
            datajs["errors"] = [{"title": "Error in running dicey. " + errInfo}] + datajs["errors"]
            return jsonify(datajs), 400
      result = gzip.open(jsonfile).read()
      if result is not None:
         datajs = json.loads(result)
      datajs['uuid'] = uuidstr
      datajs['url'] = "download/" + uuidstr
      return jsonify(datajs), 200


@app.route('/api/v1/results/<uuid>', methods = ['GET', 'POST'])
def results(uuid):
    if is_valid_uuid(uuid):
        sf = os.path.join(app.config['UPLOAD_FOLDER'], uuid[0:2])
        if os.path.exists(sf):
            sjsfilename = "padlock_" + uuid + ".json.gz"
            if os.path.isfile(os.path.join(sf, sjsfilename)):
                result = gzip.open(os.path.join(sf, sjsfilename)).read()
                if result is None:
                    datajs = []
                    datajs["errors"] = []
                else:
                    datajs = json.loads(result)
                datajs['uuid'] = uuid
                with open(os.path.join(sf, "padlock_" + uuid + ".err"), "r") as err:
                    errInfo = ": " + err.read()
                    if len(errInfo) > 3:
                        datajs["errors"] = [{"title": "Error in running padlock" + errInfo}] + datajs["errors"]
                        return jsonify(datajs), 400
                return jsonify(datajs), 200
    return jsonify(errors = [{"title": "Link outdated or invalid!"}]), 400


@app.route('/api/v1/genomeindex', methods=['POST'])
@cross_origin(origin='*')
def genomeind():
    return send_from_directory(os.path.join(PADLOCKWS, "../fm"),"genomeindexindex.json"), 200


@app.route('/api/v1/health', methods=['GET'])
def health():
    return jsonify(status="OK")

if __name__ == '__main__':
    app.run(host = '0.0.0.0', port=3300, debug = True, threaded=True)
