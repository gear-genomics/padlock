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
const targetGenomes = document.getElementById('target-genome')
const targetTabs = document.getElementById('target-tabs')
const variantsTable = document.getElementById('variants-table')
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

  const formData = new FormData()
  formData.append('geneText', document.getElementById('geneText').value);
  formData.append('armLength', aLength)
  formData.append('editDist', eDist)
  formData.append('genome', genome)

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

  renderPadlockTable(variantsTable, data.data)
}

function renderPadlockTable(container, variants) {
    console.log(variants)
  const html = `
    <table class="table table-sm table-striped table-hover">
      <thead>
        <tr>
          ${variants.columns
            .map(title => `<th scope="col">${title}</th>`)
            .join('')}
        </tr>
      </thead>
      <tbody>
        ${variants.rows
          .map(
            (row, i) => `<tr>
            ${row
              .map(
                  (value, j) => { if (value.startsWith('https://')) { return `<td title="${variants.columns[j]}"><a href="${value}" target="_blank">Link</a></td>` } else { return `<td title="${variants.columns[j]}">${value}</td>` } }
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
    gene.value = 'ENSG00000049540\nENSG00000205809\nENSG00000205810\n'
    var selectbox = document.getElementById('genome-select')
    for (var i = 0 ; i < selectbox.options.length ; i++) {
	if (selectbox.options[i].value == 'Homo_sapiens.GRCh37.dna.primary_assembly.fa.gz') {
	    selectbox.selectedIndex = i;
	}
    }
}    

window.handleTocChange = handleTocChange
function handleTocChange(select) {
  const targetId = select.value
  if (targetId !== '#') {
    document.getElementById(targetId).scrollIntoView()
    select.value = '#'
  }
}

function showElement(element) {
  element.classList.remove('d-none')
}

function hideElement(element) {
  element.classList.add('d-none')
}
