import { saveAs } from 'file-saver'

const API_URL = process.env.API_URL

$('#mainTab a').on('click', function(e) {
  e.preventDefault()
  $(this).tab('show')
})

$('[data-toggle="tooltip"]').tooltip()

const resultLink = document.getElementById('link-results')

const submitButton = document.getElementById('btn-submit')
submitButton.addEventListener('click', function() {
  resultLink.click()
  run()
})

const exampleButton = document.getElementById('btn-example')
exampleButton.addEventListener('click', showExample)

const armLength = document.querySelector('#armLength')
const editDist = document.querySelector('#editDist')
const useHamming = document.querySelector('#is_hamming')
const isAbsent = document.querySelector('#is_absent')
const useProbe = document.querySelector('#is_probe')
const allowOverlap = document.querySelector('#is_overlapping')
const colorAmount = document.querySelector('#colorAmount')
const codeLength = document.querySelector('#codeLength')
const targetGenomes = document.getElementById('target-genome')
const targetTabs = document.getElementById('target-tabs')
const padlockTable = document.getElementById('padlocks-table')
const resultContainer = document.getElementById('result-container')
const resultInfo = document.getElementById('result-info')
const resultError = document.getElementById('result-error')
const linkTsv = document.getElementById('link-tsv')
let downloadUrl

// TODO client-side validation
function run() {
  const aLength = Number.parseInt(armLength.value, 10)
  const eDist = Number.parseInt(editDist.value, 10)
  const genome = targetGenomes.querySelector('option:checked').value
  const uh = useHamming.checked
  const iab = isAbsent.checked
  const up = useProbe.checked
  const ao = allowOverlap.checked
  const colorA = Number.parseInt(colorAmount.value, 10)
  const codeL = Number.parseInt(codeLength.value, 10)

  const formData = new FormData()
  formData.append('geneText', document.getElementById('geneText').value)
  formData.append('attrGtf', document.getElementById('attrGtf').value)
  formData.append('featGtf', document.getElementById('featGtf').value)
  formData.append('armLength', aLength)
  formData.append('editDist', eDist)
  formData.append('genome', genome)
  formData.append('hamming', uh)
  formData.append('absent', iab)
  formData.append('probe', up)
  formData.append('overlap', ao)
  formData.append('colorAmount', colorA)
  formData.append('codeLength', codeL)
  formData.append('anchorSeq', document.getElementById('anchorSeq').value)
  formData.append('spacerLeft', document.getElementById('spacerLeft').value)
  formData.append('spacerRight', document.getElementById('spacerRight').value)

  hideElement(resultContainer)
  hideElement(resultError)
  showElement(resultInfo)

  axios
    .post(`${API_URL}/upload`, formData)
    .then(res => {
      if (res.status === 200) {
        handleSuccess(res.data)
      }
    })
    .catch(err => {
      let errorMessage = err
      if (err.response) {
        errorMessage = err.response.data.errors
          .map(error => error.title)
          .join('; ')
      }
      hideElement(resultInfo)
      showElement(resultError)
      resultError.querySelector('#error-message').textContent = errorMessage
    })
}

function handleSuccess(data) {
  hideElement(resultInfo)
  hideElement(resultError)
  showElement(resultContainer)

    // needed in downloadBcf() as well
  downloadUrl = data.url
  linkTsv.href = `${API_URL}/${downloadUrl}/tsv`

  renderPadlockTable(padlockTable, data.data)
}

function renderPadlockTable(container, padlocks) {
  const html = `
    <table class="table table-sm table-striped table-hover">
      <thead>
        <tr>
          ${padlocks.columns
            .map(title => `<th scope="col">${title}</th>`)
            .join('')}
        </tr>
      </thead>
      <tbody>
        ${padlocks.rows
          .map(
            (row, i) => `<tr>
            ${row
              .map(
                  (value, j) => { if (value.startsWith('https://')) { return `<td title="${padlocks.columns[j]}"><a href="${value}" target="_blank">Link</a></td>` } else { return `<td title="${padlocks.columns[j]}">${value}</td>` } }
              )
              .join('')}
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `
  container.innerHTML = html
}

function isDna(seq) {
  const dnaPat = /^[acgt]+$/i
  return dnaPat.test(seq)
}

function ungapped(seq) {
  return seq.replace(/-/g, '')
}

function showExample() {
    var gene = document.getElementById('geneText')
    gene.value = 'ENSDARG00000061385\nENSDARG00000053405\nENSDARG00000007196\n'
    var attr = document.getElementById('attrGtf')
    attr.value = "gene_id"
    var feat = document.getElementById('featGtf')
    feat.value = "exon"
    var editBox = document.getElementById('editDist')
    editBox.value = 1
    var armBox = document.getElementById('armLength')
    armBox.value = 18
    document.getElementById("is_absent").checked = false;
    document.getElementById("is_probe").checked = false;
    document.getElementById("is_overlapping").checked = false;
    document.getElementById("is_hamming").checked = false;
    var selectbox = document.getElementById('genome-select')
    for (var i = 0 ; i < selectbox.options.length ; i++) {
	if (selectbox.options[i].value == 'Danio_rerio.GRCz10.dna.toplevel.fa.gz') {
	    selectbox.selectedIndex = i;
	}
    }
}    

function showElement(element) {
  element.classList.remove('d-none')
}

function hideElement(element) {
  element.classList.add('d-none')
}
